import { Hono, Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

import { sessionMiddleware } from "@/lib/session-middleware";
import {
  DATABASE_ID,
  BATCHES_ID,
  ACADEMIC_TEAMS_ID,
  ACADEMIC_TEAM_MEMBERS_ID,
  TEAM_GUIDES_ID,
  MILESTONES_ID,
  SUBMISSIONS_ID,
  RUBRICS_ID,
  RUBRIC_CRITERIA_ID,
  EVALUATIONS_ID,
  MEMBERS_ID,
  TASKS_ID,
  CHANNELS_ID,
  CHANNEL_MEMBERS_ID,
  INVITE_LINKS_ID,
  ROLES_ID,
} from "@/config";
import { ID, Query, getAdminDatabases, getSupabaseAdminClient } from "@/lib/supabase";
import { can } from "@/lib/permissions/engine";
import { getMemberPermissionProfile } from "@/lib/permissions/server";
import { Task, TaskStatus } from "@/features/tasks/types";
import {
  createBatchSchema,
  createAcademicTeamSchema,
  assignGuideSchema,
  createMilestoneSchema,
  createSubmissionSchema,
  gradeSubmissionSchema,
  verifyTaskSchema,
  submitTaskReviewSchema,
  submitTaskWorkSchema,
  Batch,
  AcademicTeam,
  AcademicTeamMember,
  TeamGuide,
  Milestone,
  Submission,
  Rubric,
  RubricCriteria,
  Evaluation,
  BatchGroupProgress,
  GuideTaskVerificationItem,
  GuideSubmissionItem,
  TeamMilestoneItem,
} from "../types";

const deny = (c: Context, key: string) =>
  c.json(
    {
      error: `Forbidden: '${key}' permission required`,
      requiredPermission: key,
      canRequest: true,
    },
    403
  );

const app = new Hono()
  // ===========================================================================
  // 0. True Role & Persona Resolution (Single Source of Truth)
  // ===========================================================================
  .get(
    "/workspaces/:workspaceId/persona",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.param();

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const adminDatabases = getAdminDatabases("college:resolve-persona");
      const memberId = profile.id;

      // 1. Determine HOD status (Owner or Admin level <= 10)
      const isHod =
        profile.isWorkspaceOwner ||
        profile.role.level <= 10 ||
        profile.role.name?.toLowerCase().includes("owner") ||
        profile.role.name?.toLowerCase().includes("admin") ||
        profile.role.name?.toLowerCase().includes("hod") ||
        profile.role.name?.toLowerCase().includes("coordinator");

      // 2. Check if user is an assigned guide or holds faculty role
      const guideDocs = await adminDatabases.listDocuments<TeamGuide>(
        DATABASE_ID,
        TEAM_GUIDES_ID,
        [Query.contains("guide_member_id", [memberId, user.$id]), Query.limit(10)]
      ).catch(() => ({ documents: [] as TeamGuide[], total: 0 }));

      const isFacultyRole =
        profile.role.level === 20 ||
        profile.role.name?.toLowerCase().includes("faculty") ||
        profile.role.name?.toLowerCase().includes("guide") ||
        profile.role.name?.toLowerCase().includes("project manager");

      const isGuide = !isHod && (guideDocs.total > 0 || isFacultyRole);

      // 3. Check student team assignment (member vs lead)
      let isTeamLead = false;
      let isStudent = false;
      let teamId: string | null = null;
      let teamData: {
        id: string;
        teamCode: string;
        title: string;
        abstract?: string | null;
        projectId?: string | null;
        leadMemberId?: string | null;
        guideName?: string;
        guideUserId?: string | null;
      } | null = null;

      if (!isHod && !isGuide) {
        // Query academic_team_members
        const memberTeams = await adminDatabases.listDocuments<AcademicTeamMember>(
          DATABASE_ID,
          ACADEMIC_TEAM_MEMBERS_ID,
          [Query.contains("member_id", [memberId, user.$id]), Query.limit(1)]
        ).catch(() => ({ documents: [] as AcademicTeamMember[], total: 0 }));

        if (memberTeams.total > 0) {
          const atm = memberTeams.documents[0];
          teamId = atm.team_id;
          isTeamLead = atm.role === "LEAD";
          isStudent = !isTeamLead;
        } else {
          // Check if lead_member_id in academic_teams
          const leadTeams = await adminDatabases.listDocuments<AcademicTeam>(
            DATABASE_ID,
            ACADEMIC_TEAMS_ID,
            [Query.contains("lead_member_id", [memberId, user.$id]), Query.limit(1)]
          ).catch(() => ({ documents: [] as AcademicTeam[], total: 0 }));

          if (leadTeams.total > 0) {
            teamId = leadTeams.documents[0].id;
            isTeamLead = true;
            isStudent = false;
          } else {
            isStudent = true;
          }
        }

        if (teamId) {
          try {
            const teamDoc = await adminDatabases.getDocument<AcademicTeam>(
              DATABASE_ID,
              ACADEMIC_TEAMS_ID,
              teamId
            );
            const tgDoc = await adminDatabases.listDocuments<TeamGuide>(
              DATABASE_ID,
              TEAM_GUIDES_ID,
              [Query.equal("team_id", teamId), Query.limit(1)]
            ).catch(() => ({ documents: [] as TeamGuide[], total: 0 }));

            let guideName = "Not Assigned";
            let guideUserId: string | null = null;
            if (tgDoc.total > 0) {
              const gId = tgDoc.documents[0].guide_member_id;
              const gMember = await adminDatabases.getDocument<{ name?: string; email?: string; userId?: string }>(
                DATABASE_ID,
                MEMBERS_ID,
                gId
              ).catch(() => null);
              guideName = gMember?.name || gMember?.email || "Faculty Guide";
              guideUserId = gMember?.userId || gId;
            }

            teamData = {
              id: teamDoc.id,
              teamCode: teamDoc.team_code,
              title: teamDoc.title,
              abstract: teamDoc.abstract,
              projectId: teamDoc.project_id,
              leadMemberId: teamDoc.lead_member_id,
              guideName,
              guideUserId,
            };
          } catch {
            // fallback if team record lookup fails
          }
        }
      }

      // Persona Resolution & Strict Display Badges (zero Jira terminology)
      let persona: "HOD" | "FACULTY_GUIDE" | "TEAM_LEAD" | "STUDENT";
      let badgeLabel: "HOD / Coordinator" | "Faculty Guide" | "Team Lead" | "Student";

      if (isHod) {
        persona = "HOD";
        badgeLabel = "HOD / Coordinator";
      } else if (isGuide) {
        persona = "FACULTY_GUIDE";
        badgeLabel = "Faculty Guide";
      } else if (isTeamLead) {
        persona = "TEAM_LEAD";
        badgeLabel = "Team Lead";
      } else {
        persona = "STUDENT";
        badgeLabel = "Student";
      }

      return c.json({
        data: {
          persona,
          badgeLabel,
          isHod,
          isGuide,
          isTeamLead,
          isStudent,
          teamId,
          team: teamData,
          guidedTeamsCount: guideDocs.total,
        },
      });
    }
  )
  // ===========================================================================
  // 1. Batches: List and Create
  // ===========================================================================
  .get(
    "/workspaces/:workspaceId/batches",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.param();

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const adminDatabases = getAdminDatabases("college:list-batches");

      try {
        const batchesDoc = await adminDatabases.listDocuments<Batch>(
          DATABASE_ID,
          BATCHES_ID,
          [Query.equal("workspace_id", workspaceId), Query.orderDesc("created_at")]
        );

        const batchIds = batchesDoc.documents.map((b) => b.id);
        const teamCounts = new Map<string, number>();
        const milestoneCounts = new Map<string, number>();

        if (batchIds.length > 0) {
          const [allTeams, allMilestones] = await Promise.all([
            adminDatabases.listDocuments(DATABASE_ID, ACADEMIC_TEAMS_ID, [
              Query.contains("batch_id", batchIds),
            ]),
            adminDatabases.listDocuments(DATABASE_ID, MILESTONES_ID, [
              Query.contains("batch_id", batchIds),
            ]),
          ]);

          for (const t of allTeams.documents) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const bId = (t as any).batch_id;
            teamCounts.set(bId, (teamCounts.get(bId) || 0) + 1);
          }

          for (const m of allMilestones.documents) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const bId = (m as any).batch_id;
            milestoneCounts.set(bId, (milestoneCounts.get(bId) || 0) + 1);
          }
        }

        const enrichedBatches = batchesDoc.documents.map((batch) => ({
          ...batch,
          teams_count: teamCounts.get(batch.id) || 0,
          milestones_count: milestoneCounts.get(batch.id) || 0,
        }));

        return c.json({ data: enrichedBatches });
      } catch (err: unknown) {
        console.error("Error listing batches:", err);
        return c.json({ data: [] });
      }
    }
  )

  .post(
    "/workspaces/:workspaceId/batches",
    sessionMiddleware,
    zValidator("json", createBatchSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.param();
      const { name, department, academicYear } = c.req.valid("json");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      if (!can(profile, "college:batches.manage")) {
        return deny(c, "college:batches.manage");
      }

      const adminDatabases = getAdminDatabases("college:create-batch");

      const batchId = ID.unique();
      const newBatch = await adminDatabases.createDocument<Batch>(
        DATABASE_ID,
        BATCHES_ID,
        batchId,
        {
          id: batchId,
          workspace_id: workspaceId,
          name,
          department,
          academic_year: academicYear,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      );

      return c.json({ data: newBatch });
    }
  )

  // ===========================================================================
  // 2. Teams: List and Create
  // ===========================================================================
  .get(
    "/batches/:batchId/teams",
    sessionMiddleware,
    async (c) => {
      const { batchId } = c.req.param();
      const adminDatabases = getAdminDatabases("college:list-teams");

      try {
        const teamsDoc = await adminDatabases.listDocuments<AcademicTeam>(
          DATABASE_ID,
          ACADEMIC_TEAMS_ID,
          [Query.equal("batch_id", batchId), Query.orderAsc("team_code")]
        );

        const teamIds = teamsDoc.documents.map((t) => t.id);
        const membersByTeam = new Map<string, AcademicTeamMember[]>();
        const guidesByTeam = new Map<string, TeamGuide[]>();
        const nameMap = new Map<string, { name: string; email: string }>();

        if (teamIds.length > 0) {
          const [allMembersDoc, allGuidesDoc] = await Promise.all([
            adminDatabases.listDocuments<AcademicTeamMember>(
              DATABASE_ID,
              ACADEMIC_TEAM_MEMBERS_ID,
              [Query.contains("team_id", teamIds)]
            ),
            adminDatabases.listDocuments<TeamGuide>(
              DATABASE_ID,
              TEAM_GUIDES_ID,
              [Query.contains("team_id", teamIds)]
            ),
          ]);

          for (const m of allMembersDoc.documents) {
            const list = membersByTeam.get(m.team_id) || [];
            list.push(m);
            membersByTeam.set(m.team_id, list);
          }

          for (const g of allGuidesDoc.documents) {
            const list = guidesByTeam.get(g.team_id) || [];
            list.push(g);
            guidesByTeam.set(g.team_id, list);
          }

          const memberUserIds = allMembersDoc.documents.map((m) => m.member_id);
          const guideUserIds = allGuidesDoc.documents.map((g) => g.guide_member_id);
          const leadUserIds = teamsDoc.documents.map((t) => t.lead_member_id);
          const allUserIds = Array.from(
            new Set([...memberUserIds, ...guideUserIds, ...leadUserIds])
          );

          if (allUserIds.length > 0) {
            const memberProfiles = await adminDatabases.listDocuments<{
              userId: string;
              name?: string;
              email?: string;
            }>(DATABASE_ID, MEMBERS_ID, [
              Query.contains("userId", allUserIds),
            ]);

            for (const mp of memberProfiles.documents) {
              nameMap.set(mp.userId, {
                name: mp.name || mp.email || "Student",
                email: mp.email || "",
              });
            }
          }
        }

        const enrichedTeams = teamsDoc.documents.map((t) => {
          const tMembers = membersByTeam.get(t.id) || [];
          const tGuides = guidesByTeam.get(t.id) || [];

          return {
            ...t,
            lead_name: nameMap.get(t.lead_member_id)?.name || "Lead",
            lead_email: nameMap.get(t.lead_member_id)?.email || "",
            members: tMembers.map((m) => ({
              ...m,
              name: nameMap.get(m.member_id)?.name || "Member",
              email: nameMap.get(m.member_id)?.email || "",
            })),
            guides: tGuides.map((g) => ({
              ...g,
              name: nameMap.get(g.guide_member_id)?.name || "Guide",
              email: nameMap.get(g.guide_member_id)?.email || "",
            })),
          };
        });

        return c.json({ data: enrichedTeams });
      } catch (err: unknown) {
        console.error("Error listing teams:", err);
        return c.json({ data: [] });
      }
    }
  )

  .post(
    "/batches/:batchId/teams",
    sessionMiddleware,
    zValidator("json", createAcademicTeamSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { batchId } = c.req.param();
      const { teamCode, title, abstract, leadMemberId, memberIds, guideMemberId } =
        c.req.valid("json");

      const adminDatabases = getAdminDatabases("college:create-team");

      const batch = await adminDatabases.getDocument<Batch>(
        DATABASE_ID,
        BATCHES_ID,
        batchId
      );
      if (!batch) return c.json({ error: "Batch not found" }, 404);

      const profile = await getMemberPermissionProfile(
        databases,
        batch.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const isGuideOrManager =
        profile.role.name?.toLowerCase().includes("project manager") ||
        profile.role.name?.toLowerCase().includes("faculty") ||
        profile.role.name?.toLowerCase().includes("guide") ||
        profile.role.level <= 20 ||
        profile.isWorkspaceOwner ||
        can(profile, "college:teams.create") ||
        can(profile, "college:teams.manage");

      if (!isGuideOrManager) {
        return deny(c, "college:teams.create");
      }

      // Check if team code already exists in this batch
      const existingTeams = await adminDatabases.listDocuments<AcademicTeam>(
        DATABASE_ID,
        ACADEMIC_TEAMS_ID,
        [
          Query.equal("batch_id", batchId),
          Query.equal("team_code", teamCode),
          Query.limit(1),
        ]
      ).catch(() => ({ total: 0, documents: [] as AcademicTeam[] }));

      if (existingTeams.total > 0) {
        return c.json(
          { error: `Group code '${teamCode}' already exists in this batch. Please use a distinct group code.` },
          409
        );
      }

      const teamId = ID.unique();
      const targetGuideId = guideMemberId || profile.id;

      let newTeam: AcademicTeam;
      try {
        newTeam = await adminDatabases.createDocument<AcademicTeam>(
          DATABASE_ID,
          ACADEMIC_TEAMS_ID,
          teamId,
          {
            id: teamId,
            batch_id: batchId,
            team_code: teamCode,
            title,
            abstract: abstract || null,
            lead_member_id: leadMemberId || targetGuideId || profile.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        );
      } catch (err: unknown) {
        console.error("Error creating academic team:", err);
        const msg = err instanceof Error ? err.message : "Failed to create team";
        return c.json({ error: msg }, 400);
      }

      // 1. Auto-assign creating faculty guide (or guideMemberId passed)
      try {
        await adminDatabases.createDocument<TeamGuide>(
          DATABASE_ID,
          TEAM_GUIDES_ID,
          ID.unique(),
          {
            team_id: teamId,
            guide_member_id: targetGuideId,
            assigned_at: new Date().toISOString(),
          }
        );
      } catch {
        // Guide assign fallback
      }

      // 2. Add lead to team members if provided
      if (leadMemberId) {
        try {
          await adminDatabases.createDocument<AcademicTeamMember>(
            DATABASE_ID,
            ACADEMIC_TEAM_MEMBERS_ID,
            ID.unique(),
            {
              team_id: teamId,
              member_id: leadMemberId,
              role: "LEAD",
              joined_at: new Date().toISOString(),
            }
          );
        } catch {
          // Member insert fallback
        }
      }

      // Add extra members if provided
      if (Array.isArray(memberIds)) {
        for (const mId of memberIds) {
          if (mId !== leadMemberId) {
            try {
              await adminDatabases.createDocument<AcademicTeamMember>(
                DATABASE_ID,
                ACADEMIC_TEAM_MEMBERS_ID,
                ID.unique(),
                {
                  team_id: teamId,
                  member_id: mId,
                  role: "MEMBER",
                  joined_at: new Date().toISOString(),
                }
              );
            } catch {
              // ignore
            }
          }
        }
      }

      // 3. Auto-create dedicated group chat channel
      let channelId: string | null = null;
      try {
        channelId = ID.unique();
        await adminDatabases.createDocument(
          DATABASE_ID,
          CHANNELS_ID,
          channelId,
          {
            id: channelId,
            workspace_id: batch.workspace_id,
            type: "TEAM",
            name: `${teamCode.toUpperCase()} Discussion`,
            description: `Private chat channel for ${title}`,
            team_id: teamId,
            created_by: user.$id,
            is_archived: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        );

        // Add ONLY assigned Faculty Guide as channel OWNER (NEVER HOD / Workspace Admin unless they are the assigned guide)
        let guideUserId: string | null = null;
        if (guideMemberId) {
          try {
            const guideMem = await adminDatabases.getDocument<{ userId?: string }>(
              DATABASE_ID,
              MEMBERS_ID,
              guideMemberId
            );
            guideUserId = guideMem?.userId || guideMemberId;
          } catch {
            guideUserId = guideMemberId;
          }
        } else if (!profile.isWorkspaceOwner && profile.role.level <= 20) {
          guideUserId = user.$id;
        }

        if (guideUserId) {
          await adminDatabases.createDocument(
            DATABASE_ID,
            CHANNEL_MEMBERS_ID,
            ID.unique(),
            {
              channel_id: channelId,
              member_id: guideUserId,
              role: "OWNER",
              joined_at: new Date().toISOString(),
            }
          );
        }
      } catch {
        // Channel setup error ignored
      }

      // 4. Generate unique 6-character student_join_code bound specifically to this group
      const cleanPrefix = teamCode.replace(/[^A-Za-z0-9]/g, "").substring(0, 5).toUpperCase() || "GRP";
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const studentJoinCode = `${cleanPrefix}-${randomSuffix}`;

      try {
        await adminDatabases.createDocument(
          DATABASE_ID,
          INVITE_LINKS_ID,
          ID.unique(),
          {
            workspaceId: batch.workspace_id,
            code: studentJoinCode,
            academic_team_id: teamId,
            batch_id: batchId,
            target_role: "STUDENT",
            label: `Student Join Code for ${teamCode}`,
            created_by_member_id: profile.id || user.$id,
            maxUses: 10,
            uses: 0,
            revoked: false,
            created_at: new Date().toISOString(),
          }
        );
      } catch {
        // Invite link insert fallback
      }

      return c.json({
        data: {
          ...newTeam,
          student_join_code: studentJoinCode,
          channel_id: channelId,
        },
      });
    }
  )

  .post(
    "/teams/:teamId/assign-guide",
    sessionMiddleware,
    zValidator("json", assignGuideSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { teamId } = c.req.param();
      const { guideMemberId } = c.req.valid("json");

      const adminDatabases = getAdminDatabases("college:assign-guide");

      const team = await adminDatabases.getDocument<AcademicTeam>(
        DATABASE_ID,
        ACADEMIC_TEAMS_ID,
        teamId
      );
      if (!team) return c.json({ error: "Team not found" }, 404);

      const batch = await adminDatabases.getDocument<Batch>(
        DATABASE_ID,
        BATCHES_ID,
        team.batch_id
      );

      const profile = await getMemberPermissionProfile(
        databases,
        batch.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      if (!can(profile, "college:guides.assign")) {
        return deny(c, "college:guides.assign");
      }

      // Check existing guide
      const existing = await adminDatabases.listDocuments<TeamGuide>(
        DATABASE_ID,
        TEAM_GUIDES_ID,
        [
          Query.equal("team_id", teamId),
          Query.equal("guide_member_id", guideMemberId),
        ]
      );

      if (existing.documents.length === 0) {
        await adminDatabases.createDocument<TeamGuide>(
          DATABASE_ID,
          TEAM_GUIDES_ID,
          ID.unique(),
          {
            team_id: teamId,
            guide_member_id: guideMemberId,
            assigned_at: new Date().toISOString(),
          }
        );
      }

      return c.json({ data: { teamId, guideMemberId, assigned: true } });
    }
  )

  // ===========================================================================
  // 2b. Faculty Student Management (Toggle Lead & Remove Student)
  // ===========================================================================
  .patch(
    "/teams/:teamId/members/:memberId/role",
    sessionMiddleware,
    zValidator("json", z.object({ role: z.enum(["LEAD", "MEMBER"]) })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { teamId, memberId } = c.req.param();
      const { role } = c.req.valid("json");

      const adminDatabases = getAdminDatabases("college:update-member-role");

      const team = await adminDatabases.getDocument<AcademicTeam>(
        DATABASE_ID,
        ACADEMIC_TEAMS_ID,
        teamId
      );
      if (!team) return c.json({ error: "Team not found" }, 404);

      const batch = await adminDatabases.getDocument<Batch>(
        DATABASE_ID,
        BATCHES_ID,
        team.batch_id
      );

      const profile = await getMemberPermissionProfile(
        databases,
        batch.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      // Check if user is the assigned guide or has admin management rights
      const guidesDoc = await adminDatabases.listDocuments<TeamGuide>(
        DATABASE_ID,
        TEAM_GUIDES_ID,
        [Query.equal("team_id", teamId)]
      );
      const isAssignedGuide = guidesDoc.documents.some(
        (g) => g.guide_member_id === profile.id || g.guide_member_id === user.$id
      );
      const canManage =
        isAssignedGuide ||
        profile.role.level <= 20 ||
        profile.role.name?.toLowerCase().includes("guide") ||
        profile.role.name?.toLowerCase().includes("project manager") ||
        can(profile, "college:teams.manage_members") ||
        can(profile, "college:groups.manage") ||
        profile.isWorkspaceOwner;

      if (!canManage) {
        return c.json({ error: "Only the assigned Faculty Guide or HOD can manage team roles" }, 403);
      }

      if (role === "LEAD") {
        // Demote existing lead in this team
        const currentLeads = await adminDatabases.listDocuments<AcademicTeamMember>(
          DATABASE_ID,
          ACADEMIC_TEAM_MEMBERS_ID,
          [Query.equal("team_id", teamId), Query.equal("role", "LEAD")]
        );
        for (const l of currentLeads.documents) {
          const lId = l.id || (l as unknown as { $id?: string }).$id;
          if (lId) {
            await adminDatabases.updateDocument(DATABASE_ID, ACADEMIC_TEAM_MEMBERS_ID, lId, {
              role: "MEMBER",
            });
          }
        }

        // Promote target member
        const targetMembers = await adminDatabases.listDocuments<AcademicTeamMember>(
          DATABASE_ID,
          ACADEMIC_TEAM_MEMBERS_ID,
          [Query.equal("team_id", teamId), Query.equal("member_id", memberId)]
        );
        if (targetMembers.documents.length > 0) {
          const mId = targetMembers.documents[0].id || (targetMembers.documents[0] as unknown as { $id?: string }).$id;
          if (mId) {
            await adminDatabases.updateDocument(DATABASE_ID, ACADEMIC_TEAM_MEMBERS_ID, mId, {
              role: "LEAD",
            });
          }
        } else {
          await adminDatabases.createDocument(
            DATABASE_ID,
            ACADEMIC_TEAM_MEMBERS_ID,
            ID.unique(),
            {
              team_id: teamId,
              member_id: memberId,
              role: "LEAD",
              joined_at: new Date().toISOString(),
            }
          );
        }

        await adminDatabases.updateDocument(DATABASE_ID, ACADEMIC_TEAMS_ID, teamId, {
          lead_member_id: memberId,
          updated_at: new Date().toISOString(),
        });

        // Upgrade workspace roleId if Team Lead role exists
        try {
          const rolesDoc = await adminDatabases.listDocuments<{ id: string; name: string }>(
            DATABASE_ID,
            ROLES_ID,
            [Query.equal("workspaceId", batch.workspace_id)]
          );
          const leadRole = rolesDoc.documents.find(
            (r) => r.name.toLowerCase().includes("team lead") || r.name.toLowerCase().includes("lead")
          );
          if (leadRole) {
            await adminDatabases.updateDocument(DATABASE_ID, MEMBERS_ID, memberId, {
              roleId: leadRole.id,
            });
          }
        } catch {
          // ignore role update fallback
        }
      } else {
        // Demote to MEMBER
        const targetMembers = await adminDatabases.listDocuments<AcademicTeamMember>(
          DATABASE_ID,
          ACADEMIC_TEAM_MEMBERS_ID,
          [Query.equal("team_id", teamId), Query.equal("member_id", memberId)]
        );
        if (targetMembers.documents.length > 0) {
          const mId = targetMembers.documents[0].id || (targetMembers.documents[0] as unknown as { $id?: string }).$id;
          if (mId) {
            await adminDatabases.updateDocument(DATABASE_ID, ACADEMIC_TEAM_MEMBERS_ID, mId, {
              role: "MEMBER",
            });
          }
        }

        if (team.lead_member_id === memberId) {
          await adminDatabases.updateDocument(DATABASE_ID, ACADEMIC_TEAMS_ID, teamId, {
            lead_member_id: null,
            updated_at: new Date().toISOString(),
          });
        }

        // Downgrade workspace roleId to Member if needed
        try {
          const rolesDoc = await adminDatabases.listDocuments<{ id: string; name: string }>(
            DATABASE_ID,
            ROLES_ID,
            [Query.equal("workspaceId", batch.workspace_id)]
          );
          const memberRole = rolesDoc.documents.find(
            (r) => r.name.toLowerCase() === "member" || r.name.toLowerCase().includes("student")
          );
          if (memberRole) {
            await adminDatabases.updateDocument(DATABASE_ID, MEMBERS_ID, memberId, {
              roleId: memberRole.id,
            });
          }
        } catch {
          // ignore role update fallback
        }
      }

      return c.json({ data: { teamId, memberId, role } });
    }
  )

  .post(
    "/teams/:teamId/promote-lead",
    sessionMiddleware,
    zValidator("json", z.object({ studentMemberId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { teamId } = c.req.param();
      const { studentMemberId } = c.req.valid("json");

      const adminDatabases = getAdminDatabases("college:promote-team-lead");

      const team = await adminDatabases.getDocument<AcademicTeam>(
        DATABASE_ID,
        ACADEMIC_TEAMS_ID,
        teamId
      );
      if (!team) return c.json({ error: "Team not found" }, 404);

      const batch = await adminDatabases.getDocument<Batch>(
        DATABASE_ID,
        BATCHES_ID,
        team.batch_id
      );

      const profile = await getMemberPermissionProfile(
        databases,
        batch.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const guidesDoc = await adminDatabases.listDocuments<TeamGuide>(
        DATABASE_ID,
        TEAM_GUIDES_ID,
        [Query.equal("team_id", teamId)]
      );
      const isAssignedGuide = guidesDoc.documents.some(
        (g) => g.guide_member_id === profile.id || g.guide_member_id === user.$id
      );
      const canManage =
        isAssignedGuide ||
        can(profile, "college:teams.manage_members") ||
        can(profile, "college:groups.manage") ||
        profile.isWorkspaceOwner;

      if (!canManage) {
        return c.json({ error: "Only the assigned Faculty Guide or HOD can assign team lead" }, 403);
      }

      // Demote existing lead in this team
      const currentLeads = await adminDatabases.listDocuments<AcademicTeamMember>(
        DATABASE_ID,
        ACADEMIC_TEAM_MEMBERS_ID,
        [Query.equal("team_id", teamId), Query.equal("role", "LEAD")]
      );
      for (const l of currentLeads.documents) {
        const lId = l.id || (l as unknown as { $id?: string }).$id;
        if (lId) {
          await adminDatabases.updateDocument(DATABASE_ID, ACADEMIC_TEAM_MEMBERS_ID, lId, {
            role: "MEMBER",
          });
        }
      }

      // Promote target member
      const targetMembers = await adminDatabases.listDocuments<AcademicTeamMember>(
        DATABASE_ID,
        ACADEMIC_TEAM_MEMBERS_ID,
        [Query.equal("team_id", teamId), Query.equal("member_id", studentMemberId)]
      );
      if (targetMembers.documents.length > 0) {
        const mId = targetMembers.documents[0].id || (targetMembers.documents[0] as unknown as { $id?: string }).$id;
        if (mId) {
          await adminDatabases.updateDocument(DATABASE_ID, ACADEMIC_TEAM_MEMBERS_ID, mId, {
            role: "LEAD",
          });
        }
      } else {
        await adminDatabases.createDocument(
          DATABASE_ID,
          ACADEMIC_TEAM_MEMBERS_ID,
          ID.unique(),
          {
            team_id: teamId,
            member_id: studentMemberId,
            role: "LEAD",
            joined_at: new Date().toISOString(),
          }
        );
      }

      await adminDatabases.updateDocument(DATABASE_ID, ACADEMIC_TEAMS_ID, teamId, {
        lead_member_id: studentMemberId,
        updated_at: new Date().toISOString(),
      });

      // Update workspace member roleId if Team Lead role exists
      try {
        const rolesDoc = await adminDatabases.listDocuments<{ id: string; name: string }>(
          DATABASE_ID,
          ROLES_ID,
          [Query.equal("workspaceId", batch.workspace_id)]
        );
        const leadRole = rolesDoc.documents.find(
          (r) => r.name.toLowerCase().includes("team lead") || r.name.toLowerCase().includes("lead")
        );
        if (leadRole) {
          await adminDatabases.updateDocument(DATABASE_ID, MEMBERS_ID, studentMemberId, {
            roleId: leadRole.id,
          });
        }
      } catch {
        // Ignore role update fallback
      }

      return c.json({
        data: {
          teamId,
          leadMemberId: studentMemberId,
          success: true,
        },
      });
    }
  )

  .delete(
    "/teams/:teamId/members/:memberId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { teamId, memberId } = c.req.param();

      const adminDatabases = getAdminDatabases("college:remove-team-member");

      const team = await adminDatabases.getDocument<AcademicTeam>(
        DATABASE_ID,
        ACADEMIC_TEAMS_ID,
        teamId
      );
      if (!team) return c.json({ error: "Team not found" }, 404);

      const batch = await adminDatabases.getDocument<Batch>(
        DATABASE_ID,
        BATCHES_ID,
        team.batch_id
      );

      const profile = await getMemberPermissionProfile(
        databases,
        batch.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const guidesDoc = await adminDatabases.listDocuments<TeamGuide>(
        DATABASE_ID,
        TEAM_GUIDES_ID,
        [Query.equal("team_id", teamId)]
      );
      const isAssignedGuide = guidesDoc.documents.some(
        (g) => g.guide_member_id === profile.id || g.guide_member_id === user.$id
      );
      const canManage =
        isAssignedGuide ||
        can(profile, "college:teams.manage_members") ||
        can(profile, "college:groups.manage") ||
        profile.isWorkspaceOwner;

      if (!canManage) {
        return c.json({ error: "Only the assigned Faculty Guide or HOD can remove team members" }, 403);
      }

      const targetMembers = await adminDatabases.listDocuments<AcademicTeamMember>(
        DATABASE_ID,
        ACADEMIC_TEAM_MEMBERS_ID,
        [Query.equal("team_id", teamId), Query.equal("member_id", memberId)]
      );

      for (const m of targetMembers.documents) {
        const mId = m.id || (m as unknown as { $id?: string }).$id;
        if (mId) {
          await adminDatabases.deleteDocument(DATABASE_ID, ACADEMIC_TEAM_MEMBERS_ID, mId);
        }
      }

      if (team.lead_member_id === memberId) {
        await adminDatabases.updateDocument(DATABASE_ID, ACADEMIC_TEAMS_ID, teamId, {
          lead_member_id: null,
          updated_at: new Date().toISOString(),
        });
      }

      return c.json({ data: { success: true, teamId, memberId } });
    }
  )

  // ===========================================================================
  // 3. Milestones & Rubrics
  // ===========================================================================
  .get(
    "/batches/:batchId/milestones",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const { batchId } = c.req.param();
      const adminDatabases = getAdminDatabases("college:list-milestones");

      try {
        const milestonesDoc = await adminDatabases.listDocuments<Milestone>(
          DATABASE_ID,
          MILESTONES_ID,
          [Query.equal("batch_id", batchId), Query.orderAsc("order_index")]
        );

        // Find user's student team in this batch (if any)
        const myTeams = await adminDatabases.listDocuments<AcademicTeamMember>(
          DATABASE_ID,
          ACADEMIC_TEAM_MEMBERS_ID,
          [Query.equal("member_id", user.$id)]
        );
        const myTeamIds = myTeams.documents.map((m) => m.team_id);

        const enrichedMilestones = await Promise.all(
          milestonesDoc.documents.map(async (m) => {
            const rubrics = await adminDatabases.listDocuments<Rubric>(
              DATABASE_ID,
              RUBRICS_ID,
              [Query.equal("milestone_id", m.id)]
            );

            // Fetch criteria for rubrics
            const rubricCriteria = await Promise.all(
              rubrics.documents.map(async (r) => {
                const criteria = await adminDatabases.listDocuments<RubricCriteria>(
                  DATABASE_ID,
                  RUBRIC_CRITERIA_ID,
                  [Query.equal("rubric_id", r.id), Query.orderAsc("order_index")]
                );
                return { ...r, criteria: criteria.documents };
              })
            );

            // Fetch user's team submission
            let mySub: Submission | null = null;
            if (myTeamIds.length > 0) {
              const subs = await adminDatabases.listDocuments<Submission>(
                DATABASE_ID,
                SUBMISSIONS_ID,
                [
                  Query.equal("milestone_id", m.id),
                  Query.contains("team_id", myTeamIds),
                  Query.orderDesc("submitted_at"),
                ]
              );
              mySub = subs.documents[0] || null;
            }

            const totalSubs = await adminDatabases.listDocuments(
              DATABASE_ID,
              SUBMISSIONS_ID,
              [Query.equal("milestone_id", m.id)]
            );

            return {
              ...m,
              submissions_count: totalSubs.total,
              rubrics: rubricCriteria,
              my_submission: mySub,
            };
          })
        );

        return c.json({ data: enrichedMilestones });
      } catch (err: unknown) {
        console.error("Error listing milestones:", err);
        return c.json({ data: [] });
      }
    }
  )

  // ===========================================================================
  // 3a. HOD Executive Milestone Overview Matrix
  // ===========================================================================
  .get(
    "/batches/:batchId/hod-milestone-overview",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { batchId } = c.req.param();

      const adminDatabases = getAdminDatabases("college:hod-milestone-overview");

      const batch = await adminDatabases.getDocument<Batch>(
        DATABASE_ID,
        BATCHES_ID,
        batchId
      );
      if (!batch) return c.json({ error: "Batch not found" }, 404);

      const profile = await getMemberPermissionProfile(
        databases,
        batch.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const isHod =
        (profile.role?.level !== undefined && profile.role.level <= 10) ||
        can(profile, "college:batches.manage") ||
        profile.isWorkspaceOwner;
      if (!isHod) {
        return c.json(
          { error: "Only HOD and Department Coordinators can view Executive Milestone Overview" },
          403
        );
      }

      // Fetch batch milestones in sequence
      const milestonesDoc = await adminDatabases.listDocuments<Milestone>(
        DATABASE_ID,
        MILESTONES_ID,
        [Query.equal("batch_id", batchId), Query.orderAsc("order_index")]
      );
      const milestones = milestonesDoc.documents;

      // Fetch all academic teams in batch
      const teamsDoc = await adminDatabases.listDocuments<AcademicTeam>(
        DATABASE_ID,
        ACADEMIC_TEAMS_ID,
        [Query.equal("batch_id", batchId), Query.orderAsc("team_code")]
      );
      const teams = teamsDoc.documents;
      const teamIds = teams.map((t) => t.id);

      if (teams.length === 0 || milestones.length === 0) {
        return c.json({
          data: {
            batch,
            milestones,
            groups: [],
            stats: {
              total_groups: teams.length,
              total_milestones: milestones.length,
              completion_rate_percentage: 0,
              stalled_groups_count: 0,
              overdue_submissions_count: 0,
              pending_faculty_review_count: 0,
            },
          },
        });
      }

      // Fetch guides, members, and team members in parallel
      const [guidesDoc, teamMembersDoc, workspaceMembersDoc] = await Promise.all([
        adminDatabases.listDocuments<TeamGuide>(
          DATABASE_ID,
          TEAM_GUIDES_ID,
          [Query.contains("team_id", teamIds)]
        ),
        adminDatabases.listDocuments<AcademicTeamMember>(
          DATABASE_ID,
          ACADEMIC_TEAM_MEMBERS_ID,
          [Query.contains("team_id", teamIds)]
        ),
        adminDatabases.listDocuments<{ id: string; userId: string; name?: string; email?: string }>(
          DATABASE_ID,
          MEMBERS_ID,
          [Query.equal("workspaceId", batch.workspace_id)]
        ),
      ]);

      const memberMap = new Map<string, { id: string; name: string; email: string }>();
      for (const m of workspaceMembersDoc.documents) {
        const displayName = m.name || m.email?.split("@")[0] || "User";
        memberMap.set(m.id, { id: m.id, name: displayName, email: m.email || "" });
        memberMap.set(m.userId, { id: m.id, name: displayName, email: m.email || "" });
      }

      const guideByTeam = new Map<string, string>();
      for (const g of guidesDoc.documents) {
        const u = memberMap.get(g.guide_member_id);
        guideByTeam.set(g.team_id, u?.name || "Assigned Guide");
      }

      const teamRosterMap = new Map<string, { count: number; leadName: string }>();
      for (const tm of teamMembersDoc.documents) {
        const prev = teamRosterMap.get(tm.team_id) || { count: 0, leadName: "No Lead Assigned" };
        prev.count += 1;
        if (tm.role === "LEAD") {
          const u = memberMap.get(tm.member_id);
          prev.leadName = u?.name || "Student Lead";
        }
        teamRosterMap.set(tm.team_id, prev);
      }

      // Fetch all submissions for these teams
      const milestoneIds = milestones.map((m) => m.id);
      const submissionsDoc = await adminDatabases.listDocuments<Submission>(
        DATABASE_ID,
        SUBMISSIONS_ID,
        [
          Query.contains("team_id", teamIds),
          Query.contains("milestone_id", milestoneIds),
          Query.orderDesc("submitted_at"),
        ]
      );

      // Latest submission per (team_id, milestone_id)
      const submissionMap = new Map<string, Submission>();
      for (const s of submissionsDoc.documents) {
        const key = `${s.team_id}_${s.milestone_id}`;
        if (!submissionMap.has(key)) {
          submissionMap.set(key, s);
        }
      }

      // Fetch evaluations for submissions
      const subIds = Array.from(submissionMap.values()).map((s) => s.id);
      let evaluationsDoc: { documents: Evaluation[] } = { documents: [] };
      if (subIds.length > 0) {
        evaluationsDoc = await adminDatabases.listDocuments<Evaluation>(
          DATABASE_ID,
          EVALUATIONS_ID,
          [Query.contains("submission_id", subIds)]
        );
      }

      const evaluationScoreMap = new Map<string, { totalScore: number; remarks?: string | null }>();
      for (const ev of evaluationsDoc.documents) {
        const prev = evaluationScoreMap.get(ev.submission_id) || { totalScore: 0, remarks: null };
        prev.totalScore += Number(ev.score) || 0;
        if (ev.feedback && !prev.remarks) prev.remarks = ev.feedback;
        evaluationScoreMap.set(ev.submission_id, prev);
      }

      const now = new Date();
      let totalApprovedCount = 0;
      let totalOverdueCount = 0;
      let totalPendingReviewCount = 0;
      let stalledGroupsCount = 0;

      const groupRows = teams.map((team) => {
        const rosterInfo = teamRosterMap.get(team.id) || { count: 0, leadName: "Awaiting Students" };
        let teamCompletedCount = 0;
        let hasOverdue = false;

        const cells = milestones.map((m) => {
          const key = `${team.id}_${m.id}`;
          const sub = submissionMap.get(key);
          const evalData = sub ? evaluationScoreMap.get(sub.id) : null;

          let status: "NOT_SUBMITTED" | "SUBMITTED" | "CHANGES_REQUESTED" | "APPROVED" | "OVERDUE" = "NOT_SUBMITTED";
          let score: number | null = null;
          const hasActiveSubmission = Boolean(sub && (sub.status === "APPROVED" || sub.status === "SUBMITTED" || (sub.status as string) === "UNDER_REVIEW"));
          const isOverdue = Boolean(m.due_date && new Date(m.due_date) < now && !hasActiveSubmission);

          if (sub) {
            if (sub.status === "APPROVED") {
              status = "APPROVED";
              score = evalData ? evalData.totalScore : Number(m.max_marks);
              teamCompletedCount++;
              totalApprovedCount++;
            } else if (sub.status === "CHANGES_REQUESTED") {
              status = "CHANGES_REQUESTED";
              score = evalData ? evalData.totalScore : null;
            } else {
              status = "SUBMITTED";
              totalPendingReviewCount++;
            }
          } else if (isOverdue) {
            status = "OVERDUE";
            totalOverdueCount++;
            hasOverdue = true;
          }

          return {
            milestone_id: m.id,
            milestone_title: m.title,
            order_index: m.order_index,
            status,
            score,
            max_marks: Number(m.max_marks) || 100,
            is_overdue: isOverdue,
            submitted_at: sub?.submitted_at || null,
            file_url: sub?.file_url || null,
            version: sub?.version || null,
            remarks: evalData?.remarks || sub?.notes || null,
          };
        });

        if (teamCompletedCount === 0 && hasOverdue) {
          stalledGroupsCount++;
        }

        return {
          team_id: team.id,
          team_code: team.team_code,
          project_title: team.title,
          guide_name: guideByTeam.get(team.id) || "Not Assigned",
          lead_name: rosterInfo.leadName,
          member_count: rosterInfo.count,
          milestones: cells,
          completed_count: teamCompletedCount,
        };
      });

      const totalPossible = teams.length * milestones.length;
      const completionRate = totalPossible > 0 ? Math.round((totalApprovedCount / totalPossible) * 100) : 0;

      return c.json({
        data: {
          batch,
          milestones,
          groups: groupRows,
          stats: {
            total_groups: teams.length,
            total_milestones: milestones.length,
            completion_rate_percentage: completionRate,
            stalled_groups_count: stalledGroupsCount,
            overdue_submissions_count: totalOverdueCount,
            pending_faculty_review_count: totalPendingReviewCount,
          },
        },
      });
    }
  )

  // ===========================================================================
  // 3b. Faculty Group Milestone Queue (Submissions for Guided Teams)
  // ===========================================================================
  .get(
    "/batches/:batchId/guide-submissions",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { batchId } = c.req.param();

      const adminDatabases = getAdminDatabases("college:guide-submissions");

      const batch = await adminDatabases.getDocument<Batch>(
        DATABASE_ID,
        BATCHES_ID,
        batchId
      );
      if (!batch) return c.json({ error: "Batch not found" }, 404);

      const profile = await getMemberPermissionProfile(
        databases,
        batch.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const isHod = (profile.role?.level !== undefined && profile.role.level <= 10) || can(profile, "college:batches.manage") || profile.isWorkspaceOwner;

      let targetTeamIds: string[] = [];
      if (isHod) {
        const allTeams = await adminDatabases.listDocuments<AcademicTeam>(
          DATABASE_ID,
          ACADEMIC_TEAMS_ID,
          [Query.equal("batch_id", batchId)]
        );
        targetTeamIds = allTeams.documents.map((t) => t.id);
      } else {
        const currentMemberDocs = await adminDatabases.listDocuments<{ id: string; userId: string }>(
          DATABASE_ID,
          MEMBERS_ID,
          [Query.equal("workspaceId", batch.workspace_id), Query.equal("userId", user.$id)]
        );
        const memberIds = currentMemberDocs.documents.map((m) => m.id);
        const guideIdentifiers = Array.from(new Set([profile.id, user.$id, ...memberIds]));

        const guideDoc = await adminDatabases.listDocuments<TeamGuide>(
          DATABASE_ID,
          TEAM_GUIDES_ID,
          [Query.contains("guide_member_id", guideIdentifiers)]
        );
        const myTeamIds = guideDoc.documents.map((g) => g.team_id);
        if (myTeamIds.length > 0) {
          const batchTeams = await adminDatabases.listDocuments<AcademicTeam>(
            DATABASE_ID,
            ACADEMIC_TEAMS_ID,
            [Query.equal("batch_id", batchId), Query.contains("id", myTeamIds)]
          );
          targetTeamIds = batchTeams.documents.map((t) => t.id);
        }
      }

      if (targetTeamIds.length === 0) {
        return c.json({ data: [] });
      }

      const [teamsDoc, milestonesDoc] = await Promise.all([
        adminDatabases.listDocuments<AcademicTeam>(
          DATABASE_ID,
          ACADEMIC_TEAMS_ID,
          [Query.contains("id", targetTeamIds)]
        ),
        adminDatabases.listDocuments<Milestone>(
          DATABASE_ID,
          MILESTONES_ID,
          [Query.equal("batch_id", batchId), Query.orderAsc("order_index")]
        ),
      ]);

      const teamMap = new Map<string, AcademicTeam>();
      for (const t of teamsDoc.documents) teamMap.set(t.id, t);

      const milestoneMap = new Map<string, Milestone>();
      for (const m of milestonesDoc.documents) milestoneMap.set(m.id, m);

      const milestoneIds = milestonesDoc.documents.map((m) => m.id);
      let rubricsDoc: { documents: Rubric[] } = { documents: [] };
      if (milestoneIds.length > 0) {
        rubricsDoc = await adminDatabases.listDocuments<Rubric>(
          DATABASE_ID,
          RUBRICS_ID,
          [Query.contains("milestone_id", milestoneIds)]
        );
      }
      const rubricIds = rubricsDoc.documents.map((r) => r.id);

      let criteriaDoc: { documents: RubricCriteria[] } = { documents: [] };
      if (rubricIds.length > 0) {
        criteriaDoc = await adminDatabases.listDocuments<RubricCriteria>(
          DATABASE_ID,
          RUBRIC_CRITERIA_ID,
          [Query.contains("rubric_id", rubricIds), Query.orderAsc("order_index")]
        );
      }

      const criteriaByMilestone = new Map<string, Array<{ id: string; title: string; description?: string | null; max_score: number }>>();
      const rubricToMilestone = new Map<string, string>();
      for (const r of rubricsDoc.documents) rubricToMilestone.set(r.id, r.milestone_id);

      for (const c of criteriaDoc.documents) {
        const mId = rubricToMilestone.get(c.rubric_id);
        if (mId) {
          const list = criteriaByMilestone.get(mId) || [];
          list.push({
            id: c.id,
            title: c.title,
            description: c.description || null,
            max_score: Number(c.max_score) || 25,
          });
          criteriaByMilestone.set(mId, list);
        }
      }

      const submissionsDoc = await adminDatabases.listDocuments<Submission>(
        DATABASE_ID,
        SUBMISSIONS_ID,
        [
          Query.contains("team_id", targetTeamIds),
          Query.orderDesc("submitted_at"),
        ]
      );

      const subIds = submissionsDoc.documents.map((s) => s.id);
      let evaluationsDoc: { documents: Evaluation[] } = { documents: [] };
      if (subIds.length > 0) {
        evaluationsDoc = await adminDatabases.listDocuments<Evaluation>(
          DATABASE_ID,
          EVALUATIONS_ID,
          [Query.contains("submission_id", subIds)]
        );
      }

      const evalsBySub = new Map<string, Array<{ rubric_criteria_id: string; score: number; feedback?: string | null }>>();
      const totalScoreBySub = new Map<string, number>();
      const remarksBySub = new Map<string, string>();

      for (const ev of evaluationsDoc.documents) {
        const list = evalsBySub.get(ev.submission_id) || [];
        list.push({
          rubric_criteria_id: ev.rubric_criteria_id,
          score: Number(ev.score) || 0,
          feedback: ev.feedback || null,
        });
        evalsBySub.set(ev.submission_id, list);

        const currentTotal = totalScoreBySub.get(ev.submission_id) || 0;
        totalScoreBySub.set(ev.submission_id, currentTotal + (Number(ev.score) || 0));

        if (ev.feedback && !remarksBySub.has(ev.submission_id)) {
          remarksBySub.set(ev.submission_id, ev.feedback);
        }
      }

      const submitterUserIds = Array.from(new Set(submissionsDoc.documents.map((s) => s.submitted_by)));
      const membersDoc = await adminDatabases.listDocuments<{ id: string; userId: string; name?: string; email?: string }>(
        DATABASE_ID,
        MEMBERS_ID,
        submitterUserIds.length > 0 ? [Query.contains("userId", submitterUserIds)] : []
      );
      const userMap = new Map<string, string>();
      for (const m of membersDoc.documents) {
        userMap.set(m.userId, m.name || m.email || "Student");
      }

      const items: GuideSubmissionItem[] = submissionsDoc.documents.map((sub) => {
        const team = teamMap.get(sub.team_id);
        const milestone = milestoneMap.get(sub.milestone_id);
        const criteria = criteriaByMilestone.get(sub.milestone_id) || [];
        const evals = evalsBySub.get(sub.id) || [];

        return {
          submission_id: sub.id,
          milestone_id: sub.milestone_id,
          milestone_title: milestone?.title || "Milestone Review",
          milestone_description: milestone?.description || null,
          due_date: milestone?.due_date || null,
          max_marks: Number(milestone?.max_marks) || 100,
          team_id: sub.team_id,
          team_code: team?.team_code || "GRP",
          team_title: team?.title || "Academic Project",
          status: sub.status as GuideSubmissionItem["status"],
          notes: sub.notes || null,
          file_url: sub.file_url || null,
          version: sub.version || 1,
          submitted_at: sub.submitted_at,
          submitted_by_name: userMap.get(sub.submitted_by) || "Student Lead",
          rubric_criteria: criteria,
          evaluations: evals,
          total_score: totalScoreBySub.has(sub.id) ? totalScoreBySub.get(sub.id)! : null,
          remarks: remarksBySub.get(sub.id) || null,
        };
      });

      return c.json({ data: items });
    }
  )

  // ===========================================================================
  // 3c. Faculty Workspace-level Milestone Queue (Submissions across batches)
  // ===========================================================================
  .get(
    "/workspaces/:workspaceId/guide-submissions",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        batchId: z.string().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.param();
      const { batchId } = c.req.valid("query");

      const adminDatabases = getAdminDatabases("college:workspace-guide-submissions");

      const profile = await getMemberPermissionProfile(
        databases,
        workspaceId,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const currentMemberDocs = await adminDatabases.listDocuments<{ id: string; userId: string }>(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("workspaceId", workspaceId), Query.equal("userId", user.$id)]
      );
      const memberIds = currentMemberDocs.documents.map((m) => m.id);
      const guideIdentifiers = Array.from(new Set([profile.id, user.$id, ...memberIds]));

      const isHod =
        (profile.role?.level !== undefined && profile.role.level <= 10) ||
        can(profile, "college:batches.manage") ||
        profile.isWorkspaceOwner;

      let relevantBatchIds: string[] = [];
      if (batchId && batchId !== "ALL") {
        relevantBatchIds = [batchId];
      } else {
        const batchesDoc = await adminDatabases.listDocuments<Batch>(
          DATABASE_ID,
          BATCHES_ID,
          [Query.equal("workspace_id", workspaceId)]
        );
        relevantBatchIds = batchesDoc.documents.map((b) => b.id);
      }

      if (relevantBatchIds.length === 0) {
        return c.json({ data: [] });
      }

      let targetTeamIds: string[] = [];
      if (isHod) {
        const allTeams = await adminDatabases.listDocuments<AcademicTeam>(
          DATABASE_ID,
          ACADEMIC_TEAMS_ID,
          [Query.contains("batch_id", relevantBatchIds)]
        );
        targetTeamIds = allTeams.documents.map((t) => t.id);
      } else {
        const guideDoc = await adminDatabases.listDocuments<TeamGuide>(
          DATABASE_ID,
          TEAM_GUIDES_ID,
          [Query.contains("guide_member_id", guideIdentifiers)]
        );
        const myTeamIds = guideDoc.documents.map((g) => g.team_id);
        if (myTeamIds.length > 0) {
          const batchTeams = await adminDatabases.listDocuments<AcademicTeam>(
            DATABASE_ID,
            ACADEMIC_TEAMS_ID,
            [Query.contains("batch_id", relevantBatchIds), Query.contains("id", myTeamIds)]
          );
          targetTeamIds = batchTeams.documents.map((t) => t.id);
        }
      }

      if (targetTeamIds.length === 0) {
        return c.json({ data: [] });
      }

      const [teamsDoc, milestonesDoc] = await Promise.all([
        adminDatabases.listDocuments<AcademicTeam>(
          DATABASE_ID,
          ACADEMIC_TEAMS_ID,
          [Query.contains("id", targetTeamIds)]
        ),
        adminDatabases.listDocuments<Milestone>(
          DATABASE_ID,
          MILESTONES_ID,
          [Query.contains("batch_id", relevantBatchIds), Query.orderAsc("order_index")]
        ),
      ]);

      const teamMap = new Map<string, AcademicTeam>();
      for (const t of teamsDoc.documents) teamMap.set(t.id, t);

      const milestoneMap = new Map<string, Milestone>();
      for (const m of milestonesDoc.documents) milestoneMap.set(m.id, m);

      const milestoneIds = milestonesDoc.documents.map((m) => m.id);
      let rubricsDoc: { documents: Rubric[] } = { documents: [] };
      if (milestoneIds.length > 0) {
        rubricsDoc = await adminDatabases.listDocuments<Rubric>(
          DATABASE_ID,
          RUBRICS_ID,
          [Query.contains("milestone_id", milestoneIds)]
        );
      }
      const rubricIds = rubricsDoc.documents.map((r) => r.id);

      let criteriaDoc: { documents: RubricCriteria[] } = { documents: [] };
      if (rubricIds.length > 0) {
        criteriaDoc = await adminDatabases.listDocuments<RubricCriteria>(
          DATABASE_ID,
          RUBRIC_CRITERIA_ID,
          [Query.contains("rubric_id", rubricIds), Query.orderAsc("order_index")]
        );
      }

      const criteriaByMilestone = new Map<string, Array<{ id: string; title: string; description?: string | null; max_score: number }>>();
      const rubricToMilestone = new Map<string, string>();
      for (const r of rubricsDoc.documents) rubricToMilestone.set(r.id, r.milestone_id);

      for (const c of criteriaDoc.documents) {
        const mId = rubricToMilestone.get(c.rubric_id);
        if (mId) {
          const list = criteriaByMilestone.get(mId) || [];
          list.push({
            id: c.id,
            title: c.title,
            description: c.description || null,
            max_score: Number(c.max_score) || 25,
          });
          criteriaByMilestone.set(mId, list);
        }
      }

      const submissionsDoc = await adminDatabases.listDocuments<Submission>(
        DATABASE_ID,
        SUBMISSIONS_ID,
        [
          Query.contains("team_id", targetTeamIds),
          Query.orderDesc("submitted_at"),
        ]
      );

      const subIds = submissionsDoc.documents.map((s) => s.id);
      let evaluationsDoc: { documents: Evaluation[] } = { documents: [] };
      if (subIds.length > 0) {
        evaluationsDoc = await adminDatabases.listDocuments<Evaluation>(
          DATABASE_ID,
          EVALUATIONS_ID,
          [Query.contains("submission_id", subIds)]
        );
      }

      const evalsBySub = new Map<string, Array<{ rubric_criteria_id: string; score: number; feedback?: string | null }>>();
      const totalScoreBySub = new Map<string, number>();
      const remarksBySub = new Map<string, string>();

      for (const ev of evaluationsDoc.documents) {
        const list = evalsBySub.get(ev.submission_id) || [];
        list.push({
          rubric_criteria_id: ev.rubric_criteria_id,
          score: Number(ev.score) || 0,
          feedback: ev.feedback || null,
        });
        evalsBySub.set(ev.submission_id, list);

        const currentTotal = totalScoreBySub.get(ev.submission_id) || 0;
        totalScoreBySub.set(ev.submission_id, currentTotal + (Number(ev.score) || 0));

        if (ev.feedback && !remarksBySub.has(ev.submission_id)) {
          remarksBySub.set(ev.submission_id, ev.feedback);
        }
      }

      const submitterUserIds = Array.from(new Set(submissionsDoc.documents.map((s) => s.submitted_by)));
      const membersDoc = await adminDatabases.listDocuments<{ id: string; userId: string; name?: string; email?: string }>(
        DATABASE_ID,
        MEMBERS_ID,
        submitterUserIds.length > 0 ? [Query.contains("userId", submitterUserIds)] : []
      );
      const userMap = new Map<string, string>();
      for (const m of membersDoc.documents) {
        userMap.set(m.userId, m.name || m.email || "Student");
      }

      const items: GuideSubmissionItem[] = submissionsDoc.documents.map((sub) => {
        const team = teamMap.get(sub.team_id);
        const milestone = milestoneMap.get(sub.milestone_id);
        const criteria = criteriaByMilestone.get(sub.milestone_id) || [];
        const evals = evalsBySub.get(sub.id) || [];

        return {
          submission_id: sub.id,
          milestone_id: sub.milestone_id,
          milestone_title: milestone?.title || "Milestone Review",
          milestone_description: milestone?.description || null,
          due_date: milestone?.due_date || null,
          max_marks: Number(milestone?.max_marks) || 100,
          team_id: sub.team_id,
          team_code: team?.team_code || "GRP",
          team_title: team?.title || "Academic Project",
          status: sub.status as GuideSubmissionItem["status"],
          notes: sub.notes || null,
          file_url: sub.file_url || null,
          version: sub.version || 1,
          submitted_at: sub.submitted_at,
          submitted_by_name: userMap.get(sub.submitted_by) || "Student Lead",
          rubric_criteria: criteria,
          evaluations: evals,
          total_score: totalScoreBySub.has(sub.id) ? totalScoreBySub.get(sub.id)! : null,
          remarks: remarksBySub.get(sub.id) || null,
        };
      });

      return c.json({ data: items });
    }
  )

  // ===========================================================================
  // 3d. Student Group Milestone View
  // ===========================================================================
  .get(
    "/teams/:teamId/milestones",
    sessionMiddleware,
    async (c) => {
      const { teamId } = c.req.param();

      const adminDatabases = getAdminDatabases("college:team-milestones");

      const team = await adminDatabases.getDocument<AcademicTeam>(
        DATABASE_ID,
        ACADEMIC_TEAMS_ID,
        teamId
      );
      if (!team) return c.json({ error: "Team not found" }, 404);

      const batch = await adminDatabases.getDocument<Batch>(
        DATABASE_ID,
        BATCHES_ID,
        team.batch_id
      );

      const milestonesDoc = await adminDatabases.listDocuments<Milestone>(
        DATABASE_ID,
        MILESTONES_ID,
        [Query.equal("batch_id", team.batch_id), Query.orderAsc("order_index")]
      );

      const milestoneIds = milestonesDoc.documents.map((m) => m.id);
      let rubricsDoc: { documents: Rubric[] } = { documents: [] };
      if (milestoneIds.length > 0) {
        rubricsDoc = await adminDatabases.listDocuments<Rubric>(
          DATABASE_ID,
          RUBRICS_ID,
          [Query.contains("milestone_id", milestoneIds)]
        );
      }
      const rubricIds = rubricsDoc.documents.map((r) => r.id);
      const rubricToMilestone = new Map<string, string>();
      for (const r of rubricsDoc.documents) rubricToMilestone.set(r.id, r.milestone_id);

      let criteriaDoc: { documents: RubricCriteria[] } = { documents: [] };
      if (rubricIds.length > 0) {
        criteriaDoc = await adminDatabases.listDocuments<RubricCriteria>(
          DATABASE_ID,
          RUBRIC_CRITERIA_ID,
          [Query.contains("rubric_id", rubricIds), Query.orderAsc("order_index")]
        );
      }
      const criteriaByMilestone = new Map<string, Array<{ id: string; title: string; max_score: number }>>();
      for (const c of criteriaDoc.documents) {
        const mId = rubricToMilestone.get(c.rubric_id);
        if (mId) {
          const list = criteriaByMilestone.get(mId) || [];
          list.push({ id: c.id, title: c.title, max_score: Number(c.max_score) || 25 });
          criteriaByMilestone.set(mId, list);
        }
      }

      const submissionsDoc = await adminDatabases.listDocuments<Submission>(
        DATABASE_ID,
        SUBMISSIONS_ID,
        [Query.equal("team_id", teamId), Query.orderDesc("submitted_at")]
      );

      const latestSubByMilestone = new Map<string, Submission>();
      for (const s of submissionsDoc.documents) {
        if (!latestSubByMilestone.has(s.milestone_id)) {
          latestSubByMilestone.set(s.milestone_id, s);
        }
      }

      const subIds = submissionsDoc.documents.map((s) => s.id);
      let evaluationsDoc: { documents: Evaluation[] } = { documents: [] };
      if (subIds.length > 0) {
        evaluationsDoc = await adminDatabases.listDocuments<Evaluation>(
          DATABASE_ID,
          EVALUATIONS_ID,
          [Query.contains("submission_id", subIds)]
        );
      }

      const evalMap = new Map<string, { totalScore: number; remarks?: string | null; gradedAt: string; evaluatorId: string }>();
      for (const ev of evaluationsDoc.documents) {
        const prev = evalMap.get(ev.submission_id) || { totalScore: 0, remarks: null, gradedAt: ev.created_at, evaluatorId: ev.evaluator_member_id };
        prev.totalScore += Number(ev.score) || 0;
        if (ev.feedback && !prev.remarks) prev.remarks = ev.feedback;
        evalMap.set(ev.submission_id, prev);
      }

      const now = new Date();

      const items: TeamMilestoneItem[] = milestonesDoc.documents.map((m) => {
        const sub = latestSubByMilestone.get(m.id);
        const evData = sub ? evalMap.get(sub.id) : null;
        const hasActiveSub = Boolean(sub && (sub.status === "APPROVED" || sub.status === "SUBMITTED" || (sub.status as string) === "UNDER_REVIEW"));
        const isOverdue = Boolean(m.due_date && new Date(m.due_date) < now && !hasActiveSub);

        let status: TeamMilestoneItem["status"] = "NOT_SUBMITTED";
        if (sub) {
          if (sub.status === "APPROVED") status = "APPROVED";
          else if (sub.status === "CHANGES_REQUESTED") status = "CHANGES_REQUESTED";
          else status = "SUBMITTED";
        } else if (isOverdue) {
          status = "OVERDUE";
        }

        let countdown = "No deadline set";
        if (sub?.status === "APPROVED") {
          countdown = evData?.totalScore !== undefined && evData?.totalScore !== null
            ? `Approved (${evData.totalScore}/${Number(m.max_marks) || 100})`
            : "Approved";
        } else if (sub?.status === "SUBMITTED") {
          countdown = "Under Guide Review";
        } else if (sub?.status === "CHANGES_REQUESTED") {
          countdown = "Changes Requested";
        } else if (m.due_date) {
          const due = new Date(m.due_date);
          const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) countdown = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`;
          else if (diffDays === 0) countdown = "Due today";
          else countdown = `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
        }

        return {
          id: m.id,
          batch_id: m.batch_id,
          title: m.title,
          description: m.description || null,
          due_date: m.due_date || null,
          max_marks: Number(m.max_marks) || 100,
          order_index: m.order_index,
          status,
          submission: sub
            ? {
                id: sub.id,
                file_url: sub.file_url || null,
                notes: sub.notes || null,
                status: sub.status as "DRAFT" | "SUBMITTED" | "CHANGES_REQUESTED" | "APPROVED",
                submitted_at: sub.submitted_at,
                version: sub.version || 1,
              }
            : null,
          grade: evData
            ? {
                score: evData.totalScore,
                total_score: evData.totalScore,
                remarks: evData.remarks || null,
                graded_at: evData.gradedAt,
              }
            : null,
          is_overdue: isOverdue,
          countdown_label: countdown,
          rubric_criteria: criteriaByMilestone.get(m.id) || [],
        };
      });

      return c.json({
        data: {
          team,
          batch,
          milestones: items,
        },
      });
    }
  )

  .post(
    "/batches/:batchId/milestones",
    sessionMiddleware,
    zValidator("json", createMilestoneSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { batchId } = c.req.param();
      const { title, description, dueDate, orderIndex, maxMarks, criteria } =
        c.req.valid("json");

      const adminDatabases = getAdminDatabases("college:create-milestone");

      const batch = await adminDatabases.getDocument<Batch>(
        DATABASE_ID,
        BATCHES_ID,
        batchId
      );
      if (!batch) return c.json({ error: "Batch not found" }, 404);

      const profile = await getMemberPermissionProfile(
        databases,
        batch.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      if (!can(profile, "college:milestones.manage")) {
        return deny(c, "college:milestones.manage");
      }

      const milestoneId = ID.unique();
      const newMilestone = await adminDatabases.createDocument<Milestone>(
        DATABASE_ID,
        MILESTONES_ID,
        milestoneId,
        {
          id: milestoneId,
          batch_id: batchId,
          title,
          description: description || null,
          due_date: dueDate ? dueDate.toISOString() : null,
          order_index: orderIndex,
          max_marks: maxMarks,
          created_at: new Date().toISOString(),
        }
      );

      // Create default rubric with criteria
      if (criteria && criteria.length > 0) {
        const rubricId = ID.unique();
        await adminDatabases.createDocument<Rubric>(
          DATABASE_ID,
          RUBRICS_ID,
          rubricId,
          {
            id: rubricId,
            milestone_id: milestoneId,
            title: `${title} Evaluation Rubric`,
            total_weightage: maxMarks,
            created_at: new Date().toISOString(),
          }
        );

        let cIndex = 0;
        for (const crit of criteria) {
          await adminDatabases.createDocument<RubricCriteria>(
            DATABASE_ID,
            RUBRIC_CRITERIA_ID,
            ID.unique(),
            {
              rubric_id: rubricId,
              title: crit.title,
              description: crit.description || null,
              max_score: crit.maxScore,
              order_index: cIndex++,
            }
          );
        }
      }

      return c.json({ data: newMilestone });
    }
  )

  // ===========================================================================
  // 4. Submissions & Grading
  // ===========================================================================
  .post(
    "/milestones/:milestoneId/submit",
    sessionMiddleware,
    zValidator("json", createSubmissionSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { milestoneId } = c.req.param();
      const { teamId, notes, fileUrl } = c.req.valid("json");

      const adminDatabases = getAdminDatabases("college:submit-milestone");

      const milestone = await adminDatabases.getDocument<Milestone>(
        DATABASE_ID,
        MILESTONES_ID,
        milestoneId
      );
      if (!milestone) return c.json({ error: "Milestone not found" }, 404);

      const batch = await adminDatabases.getDocument<Batch>(
        DATABASE_ID,
        BATCHES_ID,
        milestone.batch_id
      );

      const profile = await getMemberPermissionProfile(
        databases,
        batch.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      if (!can(profile, "college:submissions.submit")) {
        return deny(c, "college:submissions.submit");
      }

      // Check current version
      const pastSubs = await adminDatabases.listDocuments<Submission>(
        DATABASE_ID,
        SUBMISSIONS_ID,
        [
          Query.equal("milestone_id", milestoneId),
          Query.equal("team_id", teamId),
          Query.orderDesc("version"),
        ]
      );

      const nextVersion = pastSubs.documents.length > 0 ? pastSubs.documents[0].version + 1 : 1;

      const subId = ID.unique();
      const newSubmission = await adminDatabases.createDocument<Submission>(
        DATABASE_ID,
        SUBMISSIONS_ID,
        subId,
        {
          id: subId,
          milestone_id: milestoneId,
          team_id: teamId,
          status: "SUBMITTED",
          notes: notes || null,
          file_url: fileUrl,
          version: nextVersion,
          submitted_at: new Date().toISOString(),
          submitted_by: user.$id,
        }
      );

      return c.json({ data: newSubmission });
    }
  )

  .get(
    "/submissions/:submissionId/rubrics",
    sessionMiddleware,
    async (c) => {
      const { submissionId } = c.req.param();
      const adminDatabases = getAdminDatabases("college:get-submission-rubrics");

      const submission = await adminDatabases.getDocument<Submission>(
        DATABASE_ID,
        SUBMISSIONS_ID,
        submissionId
      );
      if (!submission) return c.json({ error: "Submission not found" }, 404);

      const rubrics = await adminDatabases.listDocuments<Rubric>(
        DATABASE_ID,
        RUBRICS_ID,
        [Query.equal("milestone_id", submission.milestone_id)]
      );

      const evaluations = await adminDatabases.listDocuments<Evaluation>(
        DATABASE_ID,
        EVALUATIONS_ID,
        [Query.equal("submission_id", submissionId)]
      );

      const enrichedRubrics = await Promise.all(
        rubrics.documents.map(async (r) => {
          const criteria = await adminDatabases.listDocuments<RubricCriteria>(
            DATABASE_ID,
            RUBRIC_CRITERIA_ID,
            [Query.equal("rubric_id", r.id), Query.orderAsc("order_index")]
          );
          return {
            ...r,
            criteria: criteria.documents.map((c) => {
              const evalEntry = evaluations.documents.find(
                (e) => e.rubric_criteria_id === c.id
              );
              return {
                ...c,
                current_score: evalEntry?.score ?? null,
                feedback: evalEntry?.feedback ?? null,
              };
            }),
          };
        })
      );

      return c.json({
        data: {
          submission,
          rubrics: enrichedRubrics,
        },
      });
    }
  )

  .post(
    "/submissions/:submissionId/grade",
    sessionMiddleware,
    zValidator("json", gradeSubmissionSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { submissionId } = c.req.param();
      const { grades, status } = c.req.valid("json");

      const adminDatabases = getAdminDatabases("college:grade-submission");

      const submission = await adminDatabases.getDocument<Submission>(
        DATABASE_ID,
        SUBMISSIONS_ID,
        submissionId
      );
      if (!submission) return c.json({ error: "Submission not found" }, 404);

      const milestone = await adminDatabases.getDocument<Milestone>(
        DATABASE_ID,
        MILESTONES_ID,
        submission.milestone_id
      );
      const batch = await adminDatabases.getDocument<Batch>(
        DATABASE_ID,
        BATCHES_ID,
        milestone.batch_id
      );

      const profile = await getMemberPermissionProfile(
        databases,
        batch.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      if (!can(profile, "college:evaluations.grade")) {
        return deny(c, "college:evaluations.grade");
      }

      // Record grades
      for (const grade of grades) {
        const existing = await adminDatabases.listDocuments<Evaluation>(
          DATABASE_ID,
          EVALUATIONS_ID,
          [
            Query.equal("submission_id", submissionId),
            Query.equal("evaluator_member_id", user.$id),
            Query.equal("rubric_criteria_id", grade.rubricCriteriaId),
          ]
        );

        if (existing.documents.length > 0) {
          await adminDatabases.updateDocument(
            DATABASE_ID,
            EVALUATIONS_ID,
            existing.documents[0].id,
            {
              score: grade.score,
              feedback: grade.feedback || null,
            }
          );
        } else {
          await adminDatabases.createDocument<Evaluation>(
            DATABASE_ID,
            EVALUATIONS_ID,
            ID.unique(),
            {
              submission_id: submissionId,
              evaluator_member_id: user.$id,
              rubric_criteria_id: grade.rubricCriteriaId,
              score: grade.score,
              feedback: grade.feedback || null,
              created_at: new Date().toISOString(),
            }
          );
        }
      }

      // Update submission status
      await adminDatabases.updateDocument(
        DATABASE_ID,
        SUBMISSIONS_ID,
        submissionId,
        {
          status,
        }
      );

      return c.json({ data: { submissionId, status, graded: true } });
    }
  )

  // ===========================================================================
  // 5. Batch Export Marksheet (Structured JSON / CSV Data)
  // ===========================================================================
  .get(
    "/batches/:batchId/export-sheet",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { batchId } = c.req.param();

      const adminDatabases = getAdminDatabases("college:export-sheet");

      const batch = await adminDatabases.getDocument<Batch>(
        DATABASE_ID,
        BATCHES_ID,
        batchId
      );
      if (!batch) return c.json({ error: "Batch not found" }, 404);

      const profile = await getMemberPermissionProfile(
        databases,
        batch.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      if (!can(profile, "college:reports.export")) {
        return deny(c, "college:reports.export");
      }

      const teams = await adminDatabases.listDocuments<AcademicTeam>(
        DATABASE_ID,
        ACADEMIC_TEAMS_ID,
        [Query.equal("batch_id", batchId), Query.orderAsc("team_code")]
      );

      const milestones = await adminDatabases.listDocuments<Milestone>(
        DATABASE_ID,
        MILESTONES_ID,
        [Query.equal("batch_id", batchId), Query.orderAsc("order_index")]
      );

      const reportRows = await Promise.all(
        teams.documents.map(async (t) => {
          const members = await adminDatabases.listDocuments<AcademicTeamMember>(
            DATABASE_ID,
            ACADEMIC_TEAM_MEMBERS_ID,
            [Query.equal("team_id", t.id)]
          );
          const guides = await adminDatabases.listDocuments<TeamGuide>(
            DATABASE_ID,
            TEAM_GUIDES_ID,
            [Query.equal("team_id", t.id)]
          );

          // Calculate milestone scores
          let totalScore = 0;
          const milestoneScores: Record<string, number> = {};

          for (const m of milestones.documents) {
            const subs = await adminDatabases.listDocuments<Submission>(
              DATABASE_ID,
              SUBMISSIONS_ID,
              [
                Query.equal("milestone_id", m.id),
                Query.equal("team_id", t.id),
                Query.orderDesc("version"),
              ]
            );

            if (subs.documents.length > 0) {
              const evals = await adminDatabases.listDocuments<Evaluation>(
                DATABASE_ID,
                EVALUATIONS_ID,
                [Query.equal("submission_id", subs.documents[0].id)]
              );
              const sum = evals.documents.reduce((acc, curr) => acc + Number(curr.score), 0);
              milestoneScores[m.title] = sum;
              totalScore += sum;
            } else {
              milestoneScores[m.title] = 0;
            }
          }

          return {
            teamCode: t.team_code,
            title: t.title,
            memberCount: members.total,
            guideCount: guides.total,
            milestones: milestoneScores,
            totalMarks: totalScore,
          };
        })
      );

      return c.json({
        data: {
          batchName: batch.name,
          department: batch.department,
          academicYear: batch.academic_year,
          milestoneHeaders: milestones.documents.map((m) => m.title),
          rows: reportRows,
        },
      });
    }
  )

  // ===========================================================================
  // 11. Batch Groups Monitoring Overview (HOD / Faculty View)
  // ===========================================================================
  .get(
    "/batches/:batchId/overview",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { batchId } = c.req.param();

      const adminDatabases = getAdminDatabases("college:get-batch-overview");

      const batch = await adminDatabases
        .getDocument<Batch>(DATABASE_ID, BATCHES_ID, batchId)
        .catch(() => null);

      if (!batch) return c.json({ error: "Batch not found" }, 404);

      const profile = await getMemberPermissionProfile(
        databases,
        batch.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      // Try RPC first for optimal performance
      try {
        const adminClient = getSupabaseAdminClient();
        const { data: rpcRows, error: rpcError } = await adminClient.rpc(
          "get_batch_groups_progress",
          { p_batch_id: batchId }
        );

        if (!rpcError && rpcRows && Array.isArray(rpcRows)) {
          return c.json({ data: rpcRows as BatchGroupProgress[] });
        }
      } catch {
        // Fallback to manual aggregation if RPC is unavailable
      }

      // In-memory fallback
      try {
        const teamsDoc = await adminDatabases.listDocuments<AcademicTeam>(
          DATABASE_ID,
          ACADEMIC_TEAMS_ID,
          [Query.equal("batch_id", batchId), Query.orderAsc("team_code")]
        );

        const teamIds = teamsDoc.documents.map((t) => t.id);
        const projectIds = teamsDoc.documents.map((t) => t.project_id).filter(Boolean) as string[];

        const [guidesDoc, membersDoc, tasksDoc] = await Promise.all([
          teamIds.length > 0
            ? adminDatabases.listDocuments<TeamGuide>(DATABASE_ID, TEAM_GUIDES_ID, [
                Query.contains("team_id", teamIds),
              ])
            : { documents: [] as TeamGuide[] },
          adminDatabases.listDocuments<{ id: string; userId: string; name?: string; email?: string }>(
            DATABASE_ID,
            MEMBERS_ID,
            [Query.equal("workspaceId", batch.workspace_id)]
          ),
          projectIds.length > 0
            ? adminDatabases.listDocuments<Task>(DATABASE_ID, TASKS_ID, [
                Query.contains("projectId", projectIds),
              ])
            : { documents: [] as Task[] },
        ]);

        const memberMap = new Map<string, string>();
        for (const m of membersDoc.documents) {
          memberMap.set(m.id, m.name || m.email || "Teammate");
          memberMap.set(m.userId, m.name || m.email || "Teammate");
        }

        const guideByTeam = new Map<string, { id: string; name: string }>();
        for (const g of guidesDoc.documents) {
          guideByTeam.set(g.team_id, {
            id: g.guide_member_id,
            name: memberMap.get(g.guide_member_id) || "Faculty Guide",
          });
        }

        const tasksByProject = new Map<string, Task[]>();
        for (const t of tasksDoc.documents) {
          const list = tasksByProject.get(t.projectId) || [];
          list.push(t);
          tasksByProject.set(t.projectId, list);
        }

        const overview: BatchGroupProgress[] = teamsDoc.documents.map((t) => {
          const teamTasks = t.project_id ? tasksByProject.get(t.project_id) || [] : [];
          const total_tasks = teamTasks.length;
          const completed_tasks = teamTasks.filter(
            (task) =>
              task.status === TaskStatus.DONE ||
              task.verification_status === "APPROVED"
          ).length;
          const pending_review_tasks = teamTasks.filter(
            (task) =>
              task.verification_status === "PENDING_GUIDE_REVIEW" ||
              task.status === TaskStatus.IN_REVIEW
          ).length;

          const progress_percentage =
            total_tasks > 0 ? Math.round((completed_tasks / total_tasks) * 100) : 0;

          const guideInfo = guideByTeam.get(t.id);

          return {
            team_id: t.id,
            team_code: t.team_code,
            project_title: t.title,
            project_id: t.project_id,
            lead_name: memberMap.get(t.lead_member_id) || "Lead",
            lead_member_id: t.lead_member_id,
            guide_name: guideInfo?.name || "Not Assigned",
            guide_id: guideInfo?.id || null,
            total_tasks,
            completed_tasks,
            pending_review_tasks,
            progress_percentage,
            latest_activity_timestamp: t.updated_at || t.created_at,
          };
        });

        return c.json({ data: overview });
      } catch (err: unknown) {
        console.error("Error generating batch overview:", err);
        return c.json({ data: [] });
      }
    }
  )

  // ===========================================================================
  // 12. Guide Scoped Groups
  // ===========================================================================
  .get(
    "/guide/my-groups",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string().trim().min(1),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const { workspaceId } = c.req.valid("query");

      const adminDatabases = getAdminDatabases("college:get-guide-groups");

      // Find guide's membership ID in workspace
      const currentMemberDoc = await adminDatabases.listDocuments<{ id: string; userId: string }>(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("workspaceId", workspaceId), Query.equal("userId", user.$id)]
      );

      const memberId = currentMemberDoc.documents[0]?.id;
      if (!memberId) {
        return c.json({ data: [] });
      }

      // Find teams assigned to this guide
      const guideTeamsDoc = await adminDatabases.listDocuments<TeamGuide>(
        DATABASE_ID,
        TEAM_GUIDES_ID,
        [Query.contains("guide_member_id", [memberId, user.$id])]
      );

      const teamIds = guideTeamsDoc.documents.map((g) => g.team_id);
      if (teamIds.length === 0) {
        return c.json({ data: [] });
      }

      const teamsDoc = await adminDatabases.listDocuments<AcademicTeam>(
        DATABASE_ID,
        ACADEMIC_TEAMS_ID,
        [Query.contains("id", teamIds)]
      );

      return c.json({ data: teamsDoc.documents });
    }
  )

  // ===========================================================================
  // 12b. Guide Full Dashboard Matrix (Groups, Student Rosters, Pending Reviews)
  // ===========================================================================
  .get(
    "/guide/dashboard",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string().trim().min(1),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const { workspaceId } = c.req.valid("query");

      const adminDatabases = getAdminDatabases("college:get-guide-dashboard");

      // Find guide's membership ID in workspace
      const currentMemberDoc = await adminDatabases.listDocuments<{ id: string; userId: string }>(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("workspaceId", workspaceId), Query.equal("userId", user.$id)]
      );

      const memberId = currentMemberDoc.documents[0]?.id;
      if (!memberId) {
        return c.json({
          data: {
            groups: [],
            totalStudents: 0,
            totalPendingReviews: 0,
            batches: [],
          },
        });
      }

      // Find teams assigned to this guide
      const guideTeamsDoc = await adminDatabases.listDocuments<TeamGuide>(
        DATABASE_ID,
        TEAM_GUIDES_ID,
        [Query.contains("guide_member_id", [memberId, user.$id])]
      );

      const teamIds = guideTeamsDoc.documents.map((g) => g.team_id);
      if (teamIds.length === 0) {
        // Fetch batches in this workspace so faculty can still create their first group
        const batchesDoc = await adminDatabases.listDocuments<Batch>(
          DATABASE_ID,
          BATCHES_ID,
          [Query.equal("workspace_id", workspaceId)]
        );

        return c.json({
          data: {
            groups: [],
            totalStudents: 0,
            totalPendingReviews: 0,
            batches: batchesDoc.documents,
          },
        });
      }

      // Fetch teams, members, invite codes, channels, tasks, and batches
      const [teamsDoc, allTeamMembersDoc, workspaceMembersDoc, inviteLinksDoc, channelsDoc, batchesDoc] =
        await Promise.all([
          adminDatabases.listDocuments<AcademicTeam>(
            DATABASE_ID,
            ACADEMIC_TEAMS_ID,
            [Query.contains("id", teamIds), Query.orderAsc("team_code")]
          ),
          adminDatabases.listDocuments<AcademicTeamMember>(
            DATABASE_ID,
            ACADEMIC_TEAM_MEMBERS_ID,
            [Query.contains("team_id", teamIds)]
          ),
          adminDatabases.listDocuments<{ id: string; userId: string; name?: string; email?: string }>(
            DATABASE_ID,
            MEMBERS_ID,
            [Query.equal("workspaceId", workspaceId)]
          ),
          adminDatabases.listDocuments<{
            id: string;
            code: string;
            academic_team_id?: string;
            revoked?: boolean;
          }>(
            DATABASE_ID,
            INVITE_LINKS_ID,
            [Query.equal("workspaceId", workspaceId), Query.equal("revoked", false)]
          ),
          adminDatabases.listDocuments<{ id: string; team_id?: string }>(
            DATABASE_ID,
            CHANNELS_ID,
            [Query.equal("workspace_id", workspaceId), Query.contains("team_id", teamIds)]
          ),
          adminDatabases.listDocuments<Batch>(
            DATABASE_ID,
            BATCHES_ID,
            [Query.equal("workspace_id", workspaceId)]
          ),
        ]);

      const memberMap = new Map<string, { id: string; name: string; email: string }>();
      for (const m of workspaceMembersDoc.documents) {
        memberMap.set(m.id, {
          id: m.id,
          name: m.name || m.email?.split("@")[0] || "Student",
          email: m.email || "",
        });
        memberMap.set(m.userId, {
          id: m.id,
          name: m.name || m.email?.split("@")[0] || "Student",
          email: m.email || "",
        });
      }

      const batchMap = new Map<string, string>();
      for (const b of batchesDoc.documents) {
        batchMap.set(b.id, b.name);
      }

      // Map channels by team_id
      const channelByTeam = new Map<string, string>();
      for (const ch of channelsDoc.documents) {
        if (ch.team_id) channelByTeam.set(ch.team_id, ch.id);
      }

      // Map latest invite code by academic_team_id
      const codeByTeam = new Map<string, string>();
      for (const link of inviteLinksDoc.documents) {
        if (link.academic_team_id && !codeByTeam.has(link.academic_team_id)) {
          codeByTeam.set(link.academic_team_id, link.code);
        }
      }

      // Group members by team_id
      const membersByTeam = new Map<string, Array<{
        id: string;
        memberId: string;
        name: string;
        email: string;
        role: "LEAD" | "MEMBER";
        joined_at?: string;
      }>>();

      for (const tm of allTeamMembersDoc.documents) {
        const u = memberMap.get(tm.member_id) || {
          id: tm.member_id,
          name: "Student",
          email: "",
        };
        const list = membersByTeam.get(tm.team_id) || [];
        list.push({
          id: tm.id || (tm as unknown as { $id?: string }).$id || tm.member_id,
          memberId: tm.member_id,
          name: u.name,
          email: u.email,
          role: tm.role || "MEMBER",
          joined_at: tm.joined_at,
        });
        membersByTeam.set(tm.team_id, list);
      }

      // Fetch pending review tasks
      const projectIds = teamsDoc.documents.map((t) => t.project_id).filter(Boolean) as string[];
      let tasksDoc: { documents: Task[] } = { documents: [] };
      if (projectIds.length > 0) {
        try {
          tasksDoc = await adminDatabases.listDocuments<Task>(
            DATABASE_ID,
            TASKS_ID,
            [Query.contains("projectId", projectIds)]
          );
        } catch {
          // ignore
        }
      }

      const tasksByProject = new Map<string, Task[]>();
      for (const t of tasksDoc.documents) {
        const list = tasksByProject.get(t.projectId) || [];
        list.push(t);
        tasksByProject.set(t.projectId, list);
      }

      let totalStudents = 0;
      let totalPendingReviews = 0;

      const groups = teamsDoc.documents.map((team) => {
        const roster = membersByTeam.get(team.id) || [];
        totalStudents += roster.length;

        const teamTasks = team.project_id ? tasksByProject.get(team.project_id) || [] : [];
        const pendingTasks = teamTasks.filter(
          (t) => t.verification_status === "PENDING_GUIDE_REVIEW"
        );
        totalPendingReviews += pendingTasks.length;

        const completedTasksCount = teamTasks.filter(
          (t) => t.status === TaskStatus.DONE || t.verification_status === "APPROVED"
        ).length;

        return {
          id: team.id,
          team_code: team.team_code,
          title: team.title,
          abstract: team.abstract || null,
          batch_id: team.batch_id,
          batch_name: batchMap.get(team.batch_id) || "Default Batch",
          student_join_code: codeByTeam.get(team.id) || `${team.team_code}-JOIN`,
          channel_id: channelByTeam.get(team.id) || null,
          lead_member_id: team.lead_member_id || null,
          roster,
          pendingTasksCount: pendingTasks.length,
          totalTasksCount: teamTasks.length,
          completedTasksCount,
        };
      });

      return c.json({
        data: {
          groups,
          totalStudents,
          totalPendingReviews,
          batches: batchesDoc.documents,
        },
      });
    }
  )

  // ===========================================================================
  // 12c. HOD Real-Time Progress Matrix Alias
  // ===========================================================================
  .get(
    "/batches/:batchId/hod-overview",
    sessionMiddleware,
    async (c) => {
      const { batchId } = c.req.param();
      const adminDatabases = getAdminDatabases("college:get-hod-overview");

      const batch = await adminDatabases
        .getDocument<Batch>(DATABASE_ID, BATCHES_ID, batchId)
        .catch(() => null);

      if (!batch) return c.json({ error: "Batch not found" }, 404);

      // In-memory aggregation of all groups across this batch
      try {
        const [teamsDoc, teamGuidesDoc, teamMembersDoc, workspaceMembersDoc] =
          await Promise.all([
            adminDatabases.listDocuments<AcademicTeam>(
              DATABASE_ID,
              ACADEMIC_TEAMS_ID,
              [Query.equal("batch_id", batchId), Query.orderAsc("team_code")]
            ),
            adminDatabases.listDocuments<TeamGuide>(DATABASE_ID, TEAM_GUIDES_ID, []),
            adminDatabases.listDocuments<AcademicTeamMember>(
              DATABASE_ID,
              ACADEMIC_TEAM_MEMBERS_ID,
              []
            ),
            adminDatabases.listDocuments<{ id: string; userId: string; name?: string; email?: string }>(
              DATABASE_ID,
              MEMBERS_ID,
              [Query.equal("workspaceId", batch.workspace_id)]
            ),
          ]);

        const memberMap = new Map<string, string>();
        for (const m of workspaceMembersDoc.documents) {
          memberMap.set(m.id, m.name || m.email?.split("@")[0] || "Member");
          memberMap.set(m.userId, m.name || m.email?.split("@")[0] || "Member");
        }

        const guideByTeam = new Map<string, { id: string; name: string }>();
        for (const g of teamGuidesDoc.documents) {
          guideByTeam.set(g.team_id, {
            id: g.guide_member_id,
            name: memberMap.get(g.guide_member_id) || "Faculty Guide",
          });
        }

        const studentCountByTeam = new Map<string, number>();
        for (const tm of teamMembersDoc.documents) {
          studentCountByTeam.set(tm.team_id, (studentCountByTeam.get(tm.team_id) || 0) + 1);
        }

        const projectIds = teamsDoc.documents.map((t) => t.project_id).filter(Boolean) as string[];
        let tasksDoc: { documents: Task[] } = { documents: [] };
        if (projectIds.length > 0) {
          try {
            tasksDoc = await adminDatabases.listDocuments<Task>(
              DATABASE_ID,
              TASKS_ID,
              [Query.contains("projectId", projectIds)]
            );
          } catch {
            // ignore
          }
        }

        const tasksByProject = new Map<string, Task[]>();
        for (const t of tasksDoc.documents) {
          const list = tasksByProject.get(t.projectId) || [];
          list.push(t);
          tasksByProject.set(t.projectId, list);
        }

        const overview = teamsDoc.documents.map((t) => {
          const teamTasks = t.project_id ? tasksByProject.get(t.project_id) || [] : [];
          const total_tasks = teamTasks.length;
          const completed_tasks = teamTasks.filter(
            (task) =>
              task.status === TaskStatus.DONE ||
              task.verification_status === "APPROVED"
          ).length;
          const pending_review_tasks = teamTasks.filter(
            (task) => task.verification_status === "PENDING_GUIDE_REVIEW"
          ).length;

          const progress_percentage =
            total_tasks > 0 ? Math.round((completed_tasks / total_tasks) * 100) : 0;

          const guide = guideByTeam.get(t.id);
          const leadName = t.lead_member_id ? memberMap.get(t.lead_member_id) || "Assigned Lead" : "Unassigned";

          return {
            team_id: t.id,
            team_code: t.team_code,
            project_title: t.title,
            guide_id: guide?.id || null,
            guide_name: guide?.name || "Not Allocated",
            lead_name: leadName,
            student_count: studentCountByTeam.get(t.id) || 0,
            total_tasks,
            completed_tasks,
            pending_review_tasks,
            progress_percentage,
            latest_activity_timestamp: t.updated_at || t.created_at,
          };
        });

        return c.json({ data: overview });
      } catch (err: unknown) {
        console.error("Error generating HOD overview:", err);
        return c.json({ data: [] });
      }
    }
  )

  // ===========================================================================
  // 13. Guide Verification Queue (Pending Tasks for Verification)
  // ===========================================================================
  .get(
    "/guide/pending-tasks",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string().trim().min(1),
        batchId: z.string().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId, batchId } = c.req.valid("query");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const isHod = (profile.role?.level !== undefined && profile.role.level <= 10) || can(profile, "college:batches.manage");
      const adminDatabases = getAdminDatabases("college:get-pending-tasks");

      // Determine target teams
      let targetTeams: AcademicTeam[] = [];

      if (isHod) {
        // HOD sees all groups in batch (or workspace)
        const teamQueries = [Query.orderAsc("team_code")];
        if (batchId) {
          teamQueries.push(Query.equal("batch_id", batchId));
        }
        const allTeams = await adminDatabases.listDocuments<AcademicTeam>(
          DATABASE_ID,
          ACADEMIC_TEAMS_ID,
          teamQueries
        );
        targetTeams = allTeams.documents;
      } else {
        // Faculty Guide sees only assigned groups (check both memberId and user.$id)
        const guideDoc = await adminDatabases.listDocuments<TeamGuide>(
          DATABASE_ID,
          TEAM_GUIDES_ID,
          [Query.contains("guide_member_id", [profile.id, user.$id])]
        );

        const teamIds = guideDoc.documents.map((g) => g.team_id);
        if (teamIds.length > 0) {
          const guideTeams = await adminDatabases.listDocuments<AcademicTeam>(
            DATABASE_ID,
            ACADEMIC_TEAMS_ID,
            [Query.contains("id", teamIds)]
          );
          targetTeams = guideTeams.documents;
        }
      }

      const projectIds = targetTeams.map((t) => t.project_id).filter(Boolean) as string[];
      if (projectIds.length === 0) {
        return c.json({ data: [] });
      }

      const teamByProjectId = new Map<string, AcademicTeam>();
      for (const t of targetTeams) {
        if (t.project_id) teamByProjectId.set(t.project_id, t);
      }

      const allTasksDoc = await adminDatabases.listDocuments<Task>(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.contains("projectId", projectIds),
        ]
      );

      // Filter tasks pending verification/review
      const pendingTasks = allTasksDoc.documents.filter(
        (t) =>
          t.status === TaskStatus.IN_REVIEW ||
          t.verification_status === "PENDING_GUIDE_REVIEW" ||
          (t as unknown as { review_status?: string }).review_status === "READY_FOR_REVIEW"
      );

      const memberIds = Array.from(new Set(pendingTasks.map((t) => t.assigneeId).filter(Boolean)));
      const membersDoc = await adminDatabases.listDocuments<{ id: string; name?: string; email?: string }>(
        DATABASE_ID,
        MEMBERS_ID,
        memberIds.length > 0 ? [Query.contains("id", memberIds)] : []
      );

      const memberNameMap = new Map<string, string>();
      for (const m of membersDoc.documents) {
        memberNameMap.set(m.id, m.name || m.email || "Student");
      }

      const items: GuideTaskVerificationItem[] = pendingTasks.map((task) => {
        const team = teamByProjectId.get(task.projectId);
        const tAny = task as unknown as {
          review_status?: string;
          submission_notes?: string | null;
          submission_file_url?: string | null;
          submitted_for_review_at?: string | null;
          reviewer_feedback?: string | null;
        };

        return {
          id: task.$id || task.id,
          name: task.name,
          status: task.status,
          verification_status:
            task.verification_status || "PENDING_GUIDE_REVIEW",
          review_status: (tAny.review_status as GuideTaskVerificationItem["review_status"]) || "READY_FOR_REVIEW",
          submission_notes: tAny.submission_notes || null,
          submission_file_url: tAny.submission_file_url || null,
          submitted_for_review_at: tAny.submitted_for_review_at || null,
          reviewer_feedback: tAny.reviewer_feedback || task.guide_feedback || null,
          guide_feedback: task.guide_feedback || null,
          verified_at: task.verified_at || null,
          verified_by: task.verified_by || null,
          due_date: task.dueDate,
          team_id: team?.id || "",
          team_code: team?.team_code || "GRP",
          team_title: team?.title || "Academic Project",
          assignee_name: memberNameMap.get(task.assigneeId) || "Student",
        };
      });

      return c.json({ data: items });
    }
  )

  // Alias for guide verification queue
  .get(
    "/guide/verification-queue",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string().trim().min(1),
        batchId: z.string().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId, batchId } = c.req.valid("query");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const isHod = (profile.role?.level !== undefined && profile.role.level <= 10) || can(profile, "college:batches.manage");
      const adminDatabases = getAdminDatabases("college:get-verification-queue");

      let targetTeams: AcademicTeam[] = [];

      if (isHod) {
        const teamQueries = [Query.orderAsc("team_code")];
        if (batchId) {
          teamQueries.push(Query.equal("batch_id", batchId));
        }
        const allTeams = await adminDatabases.listDocuments<AcademicTeam>(
          DATABASE_ID,
          ACADEMIC_TEAMS_ID,
          teamQueries
        );
        targetTeams = allTeams.documents;
      } else {
        const guideDoc = await adminDatabases.listDocuments<TeamGuide>(
          DATABASE_ID,
          TEAM_GUIDES_ID,
          [Query.contains("guide_member_id", [profile.id, user.$id])]
        );

        const teamIds = guideDoc.documents.map((g) => g.team_id);
        if (teamIds.length > 0) {
          const guideTeams = await adminDatabases.listDocuments<AcademicTeam>(
            DATABASE_ID,
            ACADEMIC_TEAMS_ID,
            [Query.contains("id", teamIds)]
          );
          targetTeams = guideTeams.documents;
        }
      }

      const projectIds = targetTeams.map((t) => t.project_id).filter(Boolean) as string[];
      if (projectIds.length === 0) {
        return c.json({ data: [] });
      }

      const teamByProjectId = new Map<string, AcademicTeam>();
      for (const t of targetTeams) {
        if (t.project_id) teamByProjectId.set(t.project_id, t);
      }

      const allTasksDoc = await adminDatabases.listDocuments<Task>(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.contains("projectId", projectIds),
        ]
      );

      const pendingTasks = allTasksDoc.documents.filter(
        (t) =>
          t.status === TaskStatus.IN_REVIEW ||
          t.verification_status === "PENDING_GUIDE_REVIEW" ||
          (t as unknown as { review_status?: string }).review_status === "READY_FOR_REVIEW"
      );

      const memberIds = Array.from(new Set(pendingTasks.map((t) => t.assigneeId).filter(Boolean)));
      const membersDoc = await adminDatabases.listDocuments<{ id: string; name?: string; email?: string }>(
        DATABASE_ID,
        MEMBERS_ID,
        memberIds.length > 0 ? [Query.contains("id", memberIds)] : []
      );

      const memberNameMap = new Map<string, string>();
      for (const m of membersDoc.documents) {
        memberNameMap.set(m.id, m.name || m.email || "Student");
      }

      const items: GuideTaskVerificationItem[] = pendingTasks.map((task) => {
        const team = teamByProjectId.get(task.projectId);
        const tAny = task as unknown as {
          review_status?: string;
          submission_notes?: string | null;
          submission_file_url?: string | null;
          submitted_for_review_at?: string | null;
          reviewer_feedback?: string | null;
        };

        return {
          id: task.$id || task.id,
          name: task.name,
          status: task.status,
          verification_status:
            task.verification_status || "PENDING_GUIDE_REVIEW",
          review_status: (tAny.review_status as GuideTaskVerificationItem["review_status"]) || "READY_FOR_REVIEW",
          submission_notes: tAny.submission_notes || null,
          submission_file_url: tAny.submission_file_url || null,
          submitted_for_review_at: tAny.submitted_for_review_at || null,
          reviewer_feedback: tAny.reviewer_feedback || task.guide_feedback || null,
          guide_feedback: task.guide_feedback || null,
          verified_at: task.verified_at || null,
          verified_by: task.verified_by || null,
          due_date: task.dueDate,
          team_id: team?.id || "",
          team_code: team?.team_code || "GRP",
          team_title: team?.title || "Academic Project",
          assignee_name: memberNameMap.get(task.assigneeId) || "Student",
        };
      });

      return c.json({ data: items });
    }
  )

  // ===========================================================================
  // 14. Submit Task Work for Guide Review
  // ===========================================================================
  .post(
    "/tasks/:taskId/submit-work",
    sessionMiddleware,
    zValidator("json", submitTaskWorkSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { taskId } = c.req.param();
      const { submissionNotes, submissionFileUrl } = c.req.valid("json");

      const adminDatabases = getAdminDatabases("college:submit-task-work");

      const task = await adminDatabases
        .getDocument<Task>(DATABASE_ID, TASKS_ID, taskId)
        .catch(() => null);

      if (!task) return c.json({ error: "Task not found" }, 404);

      const profile = await getMemberPermissionProfile(databases, task.workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const now = new Date().toISOString();
      const updated = await adminDatabases.updateDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId,
        {
          status: TaskStatus.IN_REVIEW,
          verification_status: "PENDING_GUIDE_REVIEW",
          review_status: "READY_FOR_REVIEW",
          submission_notes: submissionNotes,
          submission_file_url: submissionFileUrl || null,
          submitted_for_review_at: now,
          updated_at: now,
        }
      );

      return c.json({ data: updated });
    }
  )

  .post(
    "/tasks/:taskId/submit-review",
    sessionMiddleware,
    zValidator("json", submitTaskReviewSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { taskId } = c.req.param();
      const body = c.req.valid("json");
      const notes = body.submissionNotes || body.notes;
      const fileUrl = body.submissionFileUrl || body.fileUrl;

      const adminDatabases = getAdminDatabases("college:submit-task-review");

      const task = await adminDatabases
        .getDocument<Task>(DATABASE_ID, TASKS_ID, taskId)
        .catch(() => null);

      if (!task) return c.json({ error: "Task not found" }, 404);

      const profile = await getMemberPermissionProfile(databases, task.workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const now = new Date().toISOString();
      const updated = await adminDatabases.updateDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId,
        {
          status: TaskStatus.IN_REVIEW,
          verification_status: "PENDING_GUIDE_REVIEW",
          review_status: "READY_FOR_REVIEW",
          submission_notes: notes || null,
          submission_file_url: fileUrl || null,
          submitted_for_review_at: now,
          guide_feedback: notes || null,
          updated_at: now,
        }
      );

      return c.json({ data: updated });
    }
  )

  // ===========================================================================
  // 15. Verify & Sign Off Task (Guide / HOD Decision)
  // ===========================================================================
  .post(
    "/tasks/:taskId/verify",
    sessionMiddleware,
    zValidator("json", verifyTaskSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { taskId } = c.req.param();
      const { decision, feedback } = c.req.valid("json");

      const adminDatabases = getAdminDatabases("college:verify-task");

      const task = await adminDatabases
        .getDocument<Task>(DATABASE_ID, TASKS_ID, taskId)
        .catch(() => null);

      if (!task) return c.json({ error: "Task not found" }, 404);

      const profile = await getMemberPermissionProfile(databases, task.workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const isHod = profile.role?.level !== undefined && profile.role.level <= 10;
      const hasVerifyPerm = can(profile, "college:tasks.verify");

      // Check if actor is an assigned guide for the task's academic team
      let isAssignedGuide = false;
      const teamDoc = await adminDatabases.listDocuments<AcademicTeam>(
        DATABASE_ID,
        ACADEMIC_TEAMS_ID,
        [Query.equal("project_id", task.projectId)]
      );

      if (teamDoc.documents.length > 0) {
        const team = teamDoc.documents[0];
        const guideMatch = await adminDatabases.listDocuments<TeamGuide>(
          DATABASE_ID,
          TEAM_GUIDES_ID,
          [Query.equal("team_id", team.id), Query.contains("guide_member_id", [profile.id, user.$id])]
        );
        isAssignedGuide = guideMatch.documents.length > 0;
      }

      if (!isHod && !hasVerifyPerm && !isAssignedGuide) {
        return deny(c, "college:tasks.verify");
      }

      const now = new Date().toISOString();
      const isApproved = decision === "APPROVED" || decision === "APPROVE";

      const updates: Record<string, unknown> = {
        updated_at: now,
        guide_feedback: feedback || null,
        reviewer_feedback: feedback || null,
        reviewed_at: now,
        reviewed_by: profile.id,
      };

      if (isApproved) {
        updates.status = TaskStatus.DONE;
        updates.verification_status = "APPROVED";
        updates.review_status = "APPROVED";
        updates.verified_at = now;
        updates.verified_by = user.$id;
      } else {
        updates.status = TaskStatus.IN_PROGRESS;
        updates.verification_status = "CHANGES_REQUESTED";
        updates.review_status = "CHANGES_REQUESTED";
      }

      const updated = await adminDatabases.updateDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId,
        updates
      );

      return c.json({ data: updated });
    }
  )
  .get(
    "/student/my-group",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const { workspaceId } = c.req.valid("query");
      const adminDatabases = getAdminDatabases("college:student-group");

      // 1. Get current member
      const memberDocs = await adminDatabases.listDocuments<{ id: string; name?: string; email?: string }>(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("workspaceId", workspaceId), Query.equal("userId", user.$id), Query.limit(1)]
      );
      if (memberDocs.total === 0) return c.json({ data: null });

      const member = memberDocs.documents[0];
      const memberId = member.id;

      // 2. Find team membership
      const teamMemberships = await adminDatabases.listDocuments<AcademicTeamMember>(
        DATABASE_ID,
        ACADEMIC_TEAM_MEMBERS_ID,
        [Query.equal("member_id", memberId), Query.limit(1)]
      );

      let teamId: string | null = null;
      let memberRole: "LEAD" | "MEMBER" = "MEMBER";

      if (teamMemberships.total > 0) {
        teamId = teamMemberships.documents[0].team_id;
        memberRole = teamMemberships.documents[0].role;
      } else {
        const leadTeams = await adminDatabases.listDocuments<AcademicTeam>(
          DATABASE_ID,
          ACADEMIC_TEAMS_ID,
          [Query.equal("lead_member_id", memberId), Query.limit(1)]
        );
        if (leadTeams.total > 0) {
          teamId = leadTeams.documents[0].id;
          memberRole = "LEAD";
        }
      }

      if (!teamId) {
        return c.json({ data: null });
      }

      // 3. Fetch team
      const team = await adminDatabases.getDocument<AcademicTeam>(
        DATABASE_ID,
        ACADEMIC_TEAMS_ID,
        teamId
      );

      // 4. Batch & Related Records
      const [batch, guidesDoc, membersDoc, milestonesDoc, tasksDoc, submissionsDoc] = await Promise.all([
        adminDatabases.getDocument<Batch>(DATABASE_ID, BATCHES_ID, team.batch_id).catch(() => null),
        adminDatabases.listDocuments<TeamGuide>(DATABASE_ID, TEAM_GUIDES_ID, [Query.equal("team_id", team.id)]),
        adminDatabases.listDocuments<AcademicTeamMember>(DATABASE_ID, ACADEMIC_TEAM_MEMBERS_ID, [Query.equal("team_id", team.id)]),
        adminDatabases.listDocuments<Milestone>(DATABASE_ID, MILESTONES_ID, [Query.equal("batch_id", team.batch_id), Query.orderAsc("order_index")]),
        team.project_id
          ? adminDatabases.listDocuments<Task>(DATABASE_ID, TASKS_ID, [Query.equal("projectId", team.project_id), Query.orderAsc("position")])
          : { documents: [] as Task[], total: 0 },
        adminDatabases.listDocuments<Submission>(DATABASE_ID, SUBMISSIONS_ID, [Query.equal("team_id", team.id), Query.orderDesc("submitted_at"), Query.limit(5)]),
      ]);

      let guideName = "Not Assigned";
      let guideId: string | null = null;
      if (guidesDoc.total > 0) {
        guideId = guidesDoc.documents[0].guide_member_id;
        const gMember = await adminDatabases.getDocument<{ name?: string; email?: string }>(DATABASE_ID, MEMBERS_ID, guideId).catch(() => null);
        guideName = gMember?.name || gMember?.email || "Faculty Guide";
      }

      const rosterMemberIds = membersDoc.documents.map((m) => m.member_id);
      if (team.lead_member_id && !rosterMemberIds.includes(team.lead_member_id)) {
        rosterMemberIds.push(team.lead_member_id);
      }

      const rosterMembers = await Promise.all(
        rosterMemberIds.map(async (mId) => {
          const m = await adminDatabases.getDocument<{ name?: string; email?: string }>(DATABASE_ID, MEMBERS_ID, mId).catch(() => null);
          const tRole = membersDoc.documents.find((doc) => doc.member_id === mId)?.role || (mId === team.lead_member_id ? "LEAD" : "MEMBER");
          return {
            id: mId,
            name: m?.name || m?.email || "Student",
            email: m?.email || "",
            role: tRole,
            isLead: tRole === "LEAD",
          };
        })
      );

      const tasksWithFeedback = tasksDoc.documents.filter((t) => t.guide_feedback);
      const latestFeedback = tasksWithFeedback.length > 0 ? tasksWithFeedback[tasksWithFeedback.length - 1].guide_feedback : null;

      const now = new Date();
      const upcomingMilestone = milestonesDoc.documents.find((m) => !m.due_date || new Date(m.due_date) >= now) || milestonesDoc.documents[milestonesDoc.documents.length - 1] || null;

      const completedTasks = tasksDoc.documents.filter((t) => t.status === TaskStatus.DONE || t.verification_status === "APPROVED").length;
      const progressPercentage = tasksDoc.total > 0 ? Math.round((completedTasks / tasksDoc.total) * 100) : 0;

      return c.json({
        data: {
          team: {
            id: team.id,
            team_code: team.team_code,
            title: team.title,
            abstract: team.abstract,
            project_id: team.project_id,
            batch_id: team.batch_id,
          },
          batch: batch ? { id: batch.id, name: batch.name, department: batch.department, academic_year: batch.academic_year } : null,
          userRole: memberRole,
          isLead: memberRole === "LEAD",
          guide: { id: guideId, name: guideName },
          roster: rosterMembers,
          progressPercentage,
          totalTasks: tasksDoc.total,
          completedTasks,
          pendingTasks: tasksDoc.documents.filter((t) => t.verification_status === "PENDING_GUIDE_REVIEW" || t.status === TaskStatus.IN_REVIEW).length,
          tasks: tasksDoc.documents,
          milestones: milestonesDoc.documents,
          upcomingMilestone,
          recentSubmissions: submissionsDoc.documents,
          latestFeedback,
        },
      });
    }
  );

export default app;
