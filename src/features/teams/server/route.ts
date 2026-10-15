import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

import { ID, Query, createAdminClient } from "@/lib/supabase";
import { sessionMiddleware } from "@/lib/session-middleware";
import {
  DATABASE_ID,
  MEMBERS_ID,
  ROLES_ID,
  TEAM_MEMBERS_ID,
  TEAMS_ID,
} from "@/config";
import { can } from "@/lib/permissions/engine";
import { getMemberPermissionProfile, logPermissionAudit } from "@/lib/permissions/server";
import { Member } from "@/features/members/types";
import {
  addTeamMemberSchema,
  createTeamSchema,
  Team,
  TeamMember,
  updateTeamSchema,
} from "../types";

const app = new Hono()
  // 1. List teams for workspace
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.valid("query");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { users } = await createAdminClient();

      try {
        const teamsDocs = await databases.listDocuments<Team>(
          DATABASE_ID,
          TEAMS_ID,
          [Query.equal("workspaceId", workspaceId), Query.orderAsc("name")]
        );

        // Fetch team members to compute memberCount
        const teamIds = teamsDocs.documents.map((t) => (t.id || t.$id) as string);
        let teamMembersDocs: TeamMember[] = [];
        if (teamIds.length > 0) {
          try {
            const tmRes = await databases.listDocuments<TeamMember>(
              DATABASE_ID,
              TEAM_MEMBERS_ID,
              [Query.contains("teamId", teamIds)]
            );
            teamMembersDocs = tmRes.documents;
          } catch {
            teamMembersDocs = [];
          }
        }

        // Fetch workspace members for lead info
        const membersDocs = await databases.listDocuments<Member>(
          DATABASE_ID,
          MEMBERS_ID,
          [Query.equal("workspaceId", workspaceId)]
        );
        const membersMap = new Map<string, Member>();
        await Promise.all(
          membersDocs.documents.map(async (m) => {
            const mId = (m.id || (m as unknown as { $id?: string }).$id) as string;
            try {
              const u = await users.get(m.userId);
              membersMap.set(mId, {
                ...m,
                name: u.name || u.email,
                email: u.email,
              });
            } catch {
              membersMap.set(mId, m);
            }
          })
        );

        const countsByTeam = new Map<string, number>();
        for (const tm of teamMembersDocs) {
          countsByTeam.set(tm.teamId, (countsByTeam.get(tm.teamId) || 0) + 1);
        }

        const teams = teamsDocs.documents.map((t) => {
          const tId = (t.id || t.$id) as string;
          return {
            ...t,
            id: tId,
            memberCount: countsByTeam.get(tId) || 0,
            leadMember: t.leadMemberId ? membersMap.get(t.leadMemberId) || null : null,
          };
        });

        return c.json({ data: teams });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to fetch teams";
        return c.json({ error: message, data: [] }, 200);
      }
    }
  )

  // 2. Org hierarchy & tree
  .get(
    "/hierarchy",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.valid("query");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { users } = await createAdminClient();

      try {
        const [membersRes, teamsRes, rolesRes] = await Promise.all([
          databases.listDocuments<Member>(DATABASE_ID, MEMBERS_ID, [
            Query.equal("workspaceId", workspaceId),
          ]),
          databases.listDocuments<Team>(DATABASE_ID, TEAMS_ID, [
            Query.equal("workspaceId", workspaceId),
          ]).catch(() => ({ documents: [] })),
          databases.listDocuments(DATABASE_ID, ROLES_ID, [
            Query.equal("workspaceId", workspaceId),
          ]).catch(() => ({ documents: [] })),
        ]);

        const populatedMembers = await Promise.all(
          membersRes.documents.map(async (m) => {
            const mId = (m.id || (m as unknown as { $id?: string }).$id) as string;
            let name = "";
            let email = "";
            try {
              const u = await users.get(m.userId);
              name = u.name || u.email;
              email = u.email;
            } catch {
              // ignore
            }
            return {
              id: mId,
              $id: mId,
              userId: m.userId,
              name,
              email,
              role: m.role,
              roleId: (m as Record<string, unknown>).roleId as string | null || null,
              reportsToId: (m as Record<string, unknown>).reportsToId as string | null || null,
            };
          })
        );

        return c.json({
          data: {
            members: populatedMembers,
            teams: teamsRes.documents,
            roles: rolesRes.documents,
          },
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load hierarchy";
        return c.json({ error: message }, 500);
      }
    }
  )

  // 3. Create team
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createTeamSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId, name, description, leadMemberId, parentTeamId } =
        c.req.valid("json");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (!can(profile, "workspace:settings.edit") && !can(profile, "members:roles.assign")) {
        return c.json({ error: "Forbidden: insufficient permissions to manage teams" }, 403);
      }

      const teamId = ID.unique();
      const team = await databases.createDocument(
        DATABASE_ID,
        TEAMS_ID,
        teamId,
        {
          workspaceId,
          name,
          description: description || null,
          leadMemberId: leadMemberId || null,
          parentTeamId: parentTeamId || null,
        }
      );

      // If lead member specified, add to team_members
      if (leadMemberId) {
        try {
          await databases.createDocument(
            DATABASE_ID,
            TEAM_MEMBERS_ID,
            ID.unique(),
            {
              teamId,
              memberId: leadMemberId,
            }
          );
        } catch {
          // ignore duplicate
        }
      }

      await logPermissionAudit(databases, {
        workspaceId,
        actorMemberId: profile.id,
        action: "CREATE",
        entityType: "TEAM",
        entityId: teamId,
        newValues: { name, leadMemberId, parentTeamId },
      });

      return c.json({ data: team });
    }
  )

  // 4. Update team
  .patch(
    "/:teamId",
    sessionMiddleware,
    zValidator("json", updateTeamSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { teamId } = c.req.param();
      const updates = c.req.valid("json");

      const team = await databases.getDocument<Team>(DATABASE_ID, TEAMS_ID, teamId);
      if (!team) {
        return c.json({ error: "Team not found" }, 404);
      }

      const profile = await getMemberPermissionProfile(databases, team.workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (!can(profile, "workspace:settings.edit") && !can(profile, "members:roles.assign")) {
        return c.json({ error: "Forbidden" }, 403);
      }

      const updated = await databases.updateDocument(
        DATABASE_ID,
        TEAMS_ID,
        teamId,
        {
          ...(updates.name ? { name: updates.name } : {}),
          ...(updates.description !== undefined ? { description: updates.description } : {}),
          ...(updates.leadMemberId !== undefined ? { leadMemberId: updates.leadMemberId } : {}),
          ...(updates.parentTeamId !== undefined ? { parentTeamId: updates.parentTeamId } : {}),
        }
      );

      await logPermissionAudit(databases, {
        workspaceId: team.workspaceId,
        actorMemberId: profile.id,
        action: "UPDATE",
        entityType: "TEAM",
        entityId: teamId,
        newValues: updates,
      });

      return c.json({ data: updated });
    }
  )

  // 5. Delete team
  .delete(
    "/:teamId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { teamId } = c.req.param();

      const team = await databases.getDocument<Team>(DATABASE_ID, TEAMS_ID, teamId);
      if (!team) {
        return c.json({ error: "Team not found" }, 404);
      }

      const profile = await getMemberPermissionProfile(databases, team.workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (!can(profile, "workspace:settings.edit") && !can(profile, "members:roles.assign")) {
        return c.json({ error: "Forbidden" }, 403);
      }

      // Remove team members
      try {
        const teamMembers = await databases.listDocuments<{ id?: string; $id?: string }>(
          DATABASE_ID,
          TEAM_MEMBERS_ID,
          [Query.equal("teamId", teamId)]
        );
        for (const tm of teamMembers.documents) {
          const tmId = (tm.id || tm.$id) as string;
          if (tmId) {
            await databases.deleteDocument(DATABASE_ID, TEAM_MEMBERS_ID, tmId);
          }
        }
      } catch {
        // ignore
      }

      await databases.deleteDocument(DATABASE_ID, TEAMS_ID, teamId);

      await logPermissionAudit(databases, {
        workspaceId: team.workspaceId,
        actorMemberId: profile.id,
        action: "DELETE",
        entityType: "TEAM",
        entityId: teamId,
        oldValues: { name: team.name },
      });

      return c.json({ data: { id: teamId } });
    }
  )

  // 6. Get team members
  .get(
    "/:teamId/members",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { teamId } = c.req.param();

      const team = await databases.getDocument<Team>(DATABASE_ID, TEAMS_ID, teamId);
      if (!team) {
        return c.json({ error: "Team not found" }, 404);
      }

      const profile = await getMemberPermissionProfile(databases, team.workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { users } = await createAdminClient();

      const teamMembers = await databases.listDocuments<TeamMember>(
        DATABASE_ID,
        TEAM_MEMBERS_ID,
        [Query.equal("teamId", teamId)]
      );

      const memberIds = teamMembers.documents.map((tm) => tm.memberId);
      let members: Member[] = [];
      if (memberIds.length > 0) {
        const mDocs = await databases.listDocuments<Member>(
          DATABASE_ID,
          MEMBERS_ID,
          [Query.contains("id", memberIds)]
        );
        members = await Promise.all(
          mDocs.documents.map(async (m) => {
            try {
              const u = await users.get(m.userId);
              return {
                ...m,
                name: u.name || u.email,
                email: u.email,
              };
            } catch {
              return m;
            }
          })
        );
      }

      return c.json({ data: members });
    }
  )

  // 7. Add member to team
  .post(
    "/:teamId/members",
    sessionMiddleware,
    zValidator("json", addTeamMemberSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { teamId } = c.req.param();
      const { memberId } = c.req.valid("json");

      const team = await databases.getDocument<Team>(DATABASE_ID, TEAMS_ID, teamId);
      if (!team) {
        return c.json({ error: "Team not found" }, 404);
      }

      const profile = await getMemberPermissionProfile(databases, team.workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (!can(profile, "workspace:settings.edit") && !can(profile, "members:roles.assign")) {
        return c.json({ error: "Forbidden" }, 403);
      }

      // Check existing
      const existing = await databases.listDocuments(
        DATABASE_ID,
        TEAM_MEMBERS_ID,
        [Query.equal("teamId", teamId), Query.equal("memberId", memberId)]
      );
      if (existing.total > 0) {
        return c.json({ data: existing.documents[0] });
      }

      const doc = await databases.createDocument(
        DATABASE_ID,
        TEAM_MEMBERS_ID,
        ID.unique(),
        {
          teamId,
          memberId,
        }
      );

      return c.json({ data: doc });
    }
  )

  // 8. Remove member from team
  .delete(
    "/:teamId/members/:memberId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { teamId, memberId } = c.req.param();

      const team = await databases.getDocument<Team>(DATABASE_ID, TEAMS_ID, teamId);
      if (!team) {
        return c.json({ error: "Team not found" }, 404);
      }

      const profile = await getMemberPermissionProfile(databases, team.workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (!can(profile, "workspace:settings.edit") && !can(profile, "members:roles.assign")) {
        return c.json({ error: "Forbidden" }, 403);
      }

      const existing = await databases.listDocuments<{ id?: string; $id?: string }>(
        DATABASE_ID,
        TEAM_MEMBERS_ID,
        [Query.equal("teamId", teamId), Query.equal("memberId", memberId)]
      );

      for (const doc of existing.documents) {
        const docId = (doc.id || doc.$id) as string;
        if (docId) {
          await databases.deleteDocument(DATABASE_ID, TEAM_MEMBERS_ID, docId);
        }
      }

      return c.json({ data: { teamId, memberId } });
    }
  );

export default app;
