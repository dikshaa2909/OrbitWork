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

      if (!can(profile, "college:teams.create") && !can(profile, "college:teams.manage")) {
        return deny(c, "college:teams.create");
      }

      const teamId = ID.unique();
      const newTeam = await adminDatabases.createDocument<AcademicTeam>(
        DATABASE_ID,
        ACADEMIC_TEAMS_ID,
        teamId,
        {
          id: teamId,
          batch_id: batchId,
          team_code: teamCode,
          title,
          abstract: abstract || null,
          lead_member_id: leadMemberId || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      );

      // 1. Auto-assign creating faculty guide (or guideMemberId passed)
      const targetGuideId = guideMemberId || profile.memberId || profile.id;
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
            type: "GROUP",
            name: `${teamCode.toUpperCase()} Discussion`,
            description: `Private chat channel for ${title}`,
            team_id: teamId,
            created_by: user.$id,
            is_archived: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        );

        // Add faculty member as channel OWNER
        await adminDatabases.createDocument(
          DATABASE_ID,
          CHANNEL_MEMBERS_ID,
          ID.unique(),
          {
            channel_id: channelId,
            member_id: user.$id,
            role: "OWNER",
            joined_at: new Date().toISOString(),
          }
        );
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
            created_by_member_id: profile.memberId || profile.id || user.$id,
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
        // Faculty Guide sees only assigned groups
        const guideDoc = await adminDatabases.listDocuments<TeamGuide>(
          DATABASE_ID,
          TEAM_GUIDES_ID,
          [Query.contains("guide_member_id", [user.$id])]
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

      const pendingTasksDoc = await adminDatabases.listDocuments<Task>(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.contains("projectId", projectIds),
          Query.equal("status", TaskStatus.IN_REVIEW),
        ]
      );

      const memberIds = Array.from(new Set(pendingTasksDoc.documents.map((t) => t.assigneeId)));
      const membersDoc = await adminDatabases.listDocuments<{ id: string; name?: string; email?: string }>(
        DATABASE_ID,
        MEMBERS_ID,
        memberIds.length > 0 ? [Query.contains("id", memberIds)] : []
      );

      const memberNameMap = new Map<string, string>();
      for (const m of membersDoc.documents) {
        memberNameMap.set(m.id, m.name || m.email || "Student");
      }

      const items: GuideTaskVerificationItem[] = pendingTasksDoc.documents.map((task) => {
        const team = teamByProjectId.get(task.projectId);
        return {
          id: task.$id || task.id,
          name: task.name,
          status: task.status,
          verification_status:
            task.verification_status || "PENDING_GUIDE_REVIEW",
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
  // 14. Submit Task for Guide Review
  // ===========================================================================
  .post(
    "/tasks/:taskId/submit-review",
    sessionMiddleware,
    zValidator("json", submitTaskReviewSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { taskId } = c.req.param();
      const { notes } = c.req.valid("json");

      const adminDatabases = getAdminDatabases("college:submit-task-review");

      const task = await adminDatabases
        .getDocument<Task>(DATABASE_ID, TASKS_ID, taskId)
        .catch(() => null);

      if (!task) return c.json({ error: "Task not found" }, 404);

      const profile = await getMemberPermissionProfile(databases, task.workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const updated = await adminDatabases.updateDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId,
        {
          status: TaskStatus.IN_REVIEW,
          verification_status: "PENDING_GUIDE_REVIEW",
          guide_feedback: notes || null,
          updated_at: new Date().toISOString(),
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
          [Query.equal("team_id", team.id), Query.contains("guide_member_id", [user.$id])]
        );
        isAssignedGuide = guideMatch.documents.length > 0;
      }

      if (!isHod && !hasVerifyPerm && !isAssignedGuide) {
        return deny(c, "college:tasks.verify");
      }

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        guide_feedback: feedback || null,
      };

      if (decision === "APPROVED") {
        updates.status = TaskStatus.DONE;
        updates.verification_status = "APPROVED";
        updates.verified_at = new Date().toISOString();
        updates.verified_by = user.$id;
      } else {
        updates.status = TaskStatus.IN_PROGRESS;
        updates.verification_status = "CHANGES_REQUESTED";
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
