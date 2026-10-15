import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";

import { ID, Query, DocumentModel, getAdminDatabases } from "@/lib/supabase";

import { Member, MemberRole } from "@/features/members/types";
import { TaskStatus } from "@/features/tasks/types";
import { getMember } from "@/features/members/utils";

import { generateInviteCode } from "@/lib/utils";
import { sessionMiddleware } from "@/lib/session-middleware";
import { DATABASE_ID, IMAGES_BUCKET_ID, MEMBERS_ID, PROJECTS_ID, SPRINTS_ID, TASKS_ID, WORKSPACES_ID, INVITE_LINKS_ID, ROLES_ID } from "@/config";
import { getMemberPermissionProfile } from "@/lib/permissions/server";
import { can } from "@/lib/permissions/engine";

import { Workspace } from "../types";
import { createWorkspaceSchema, updateWorkspaceSchema } from "../schemas";

import { Context } from "hono";

/** 403 helper: consistent deny shape */
const deny = (c: Context, key: string) =>
  c.json({ error: `Forbidden: '${key}' permission required`, requiredPermission: key, canRequest: true }, 403);

const app = new Hono()
  .get("/", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");

    const members = await databases.listDocuments<Member>(
      DATABASE_ID,
      MEMBERS_ID,
      [Query.equal("userId", user.$id)]
    );

    if (members.total === 0) {
      return c.json({ data: { documents: [], total: 0 } });
    }

    const workspaceIds = members.documents.map((member) => member.workspaceId);

    const workspaces = await databases.listDocuments<Workspace>(
      DATABASE_ID,
      WORKSPACES_ID,
      [
        Query.orderDesc("created_at"),
        Query.contains("id", workspaceIds)
      ],
    );

    return c.json({ data: workspaces });
  })
  .get(
    "/:workspaceId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.param();

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const workspace = await databases.getDocument<Workspace>(
        DATABASE_ID,
        WORKSPACES_ID,
        workspaceId,
      );

      return c.json({ data: workspace });
    }
  )
  .get(
    "/:workspaceId/info",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workspaceId } = c.req.param();
      const code = c.req.query("code");

      const adminDatabases = getAdminDatabases("workspaces:info");
      const workspace = await adminDatabases.getDocument<Workspace>(
        DATABASE_ID,
        WORKSPACES_ID,
        workspaceId,
      );

      // Check membership
      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      // If not an existing member, require valid invite code (workspace code or active invite link)
      if (!member) {
        let isValidCode = false;
        if (code && workspace.inviteCode && workspace.inviteCode.toUpperCase() === code.trim().toUpperCase()) {
          isValidCode = true;
        } else if (code) {
          try {
            const links = await adminDatabases.listDocuments<{ expiresAt?: string; maxUses?: number; uses?: number }>(
              DATABASE_ID,
              INVITE_LINKS_ID,
              [
                Query.equal("workspaceId", workspaceId),
                Query.equal("code", code.trim().toUpperCase()),
                Query.equal("revoked", false),
                Query.limit(1),
              ]
            );
            if (links.total > 0) {
              const link = links.documents[0];
              const notExpired = !link.expiresAt || new Date(link.expiresAt) > new Date();
              const notExhausted = !link.maxUses || (link.uses ?? 0) < link.maxUses;
              if (notExpired && notExhausted) {
                isValidCode = true;
              }
            }
          } catch {
            // If table lookup fails
          }
        }

        if (!isValidCode) {
          return c.json({ error: "Valid invite code or workspace membership required" }, 403);
        }
      }

      return c.json({ 
        data: { 
          $id: workspace.$id, 
          id: workspace.id || workspace.$id,
          name: workspace.name, 
          imageUrl: workspace.imageUrl
        } 
      });
    }
  )
  .post(
    "/",
    zValidator("form", createWorkspaceSchema),
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const storage = c.get("storage");
      const user = c.get("user");

      const { name, image } = c.req.valid("form");

      let uploadedImageUrl: string | undefined;

      if (image instanceof File) {
        const file = await storage.createFile(
          IMAGES_BUCKET_ID,
          ID.unique(),
          image,
        );

        uploadedImageUrl = storage.getFileUrl(
          IMAGES_BUCKET_ID,
          file.$id || file.id,
        );
      }

      const workspace = await databases.createDocument(
        DATABASE_ID,
        WORKSPACES_ID,
        ID.unique(),
        {
          name,
          userId: user.$id,
          imageUrl: uploadedImageUrl,
          inviteCode: generateInviteCode(6),
        },
      );

      let ownerRoleId: string | undefined;
      try {
        const roles = await databases.listDocuments(DATABASE_ID, ROLES_ID, [
          Query.equal("workspaceId", workspace.$id),
          Query.equal("name", "Owner"),
        ]);
        if (roles.total > 0) {
          const firstRole = roles.documents[0] as { $id?: string; id?: string };
          ownerRoleId = firstRole.$id || firstRole.id;
        }
      } catch {
        // Fallback
      }

      await databases.createDocument(
        DATABASE_ID,
        MEMBERS_ID,
        ID.unique(),
        {
          userId: user.$id,
          workspaceId: workspace.$id,
          role: MemberRole.OWNER,
          ...(ownerRoleId ? { roleId: ownerRoleId } : {}),
        },
      );

      return c.json({ data: workspace });
    }
  )
  .patch(
    "/:workspaceId",
    sessionMiddleware,
    zValidator("form", updateWorkspaceSchema),
    async (c) => {
      const databases = c.get("databases");
      const storage = c.get("storage");
      const user = c.get("user");

      const { workspaceId } = c.req.param();
      const { name, image } = c.req.valid("form");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "workspace:settings.edit")) return deny(c, "workspace:settings.edit");

      let uploadedImageUrl: string | undefined;

      if (image instanceof File) {
        const file = await storage.createFile(
          IMAGES_BUCKET_ID,
          ID.unique(),
          image,
        );

        uploadedImageUrl = storage.getFileUrl(
          IMAGES_BUCKET_ID,
          file.$id || file.id,
        );
      } else {
        uploadedImageUrl = image;
      } 

      const workspace = await databases.updateDocument(
        DATABASE_ID,
        WORKSPACES_ID,
        workspaceId,
        {
          name,
          imageUrl: uploadedImageUrl
        }
      );

      return c.json({ data: workspace });
    }
  )
  .delete(
    "/:workspaceId",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { workspaceId } = c.req.param();

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "workspace:delete")) return deny(c, "workspace:delete");

      // Cascade delete workspace entities
      try {
        // Delete tasks
        const wsTasks = await databases.listDocuments<DocumentModel>(
          DATABASE_ID,
          TASKS_ID,
          [Query.equal("workspaceId", workspaceId)]
        );
        for (const t of wsTasks.documents) {
          await databases.deleteDocument(DATABASE_ID, TASKS_ID, t.id);
        }

        // Delete sprints
        const wsSprints = await databases.listDocuments<DocumentModel>(
          DATABASE_ID,
          SPRINTS_ID,
          [Query.equal("workspaceId", workspaceId)]
        );
        for (const s of wsSprints.documents) {
          await databases.deleteDocument(DATABASE_ID, SPRINTS_ID, s.id);
        }

        // Delete projects
        const wsProjects = await databases.listDocuments<DocumentModel>(
          DATABASE_ID,
          PROJECTS_ID,
          [Query.equal("workspaceId", workspaceId)]
        );
        for (const p of wsProjects.documents) {
          await databases.deleteDocument(DATABASE_ID, PROJECTS_ID, p.id);
        }

        // Delete members
        const wsMembers = await databases.listDocuments<DocumentModel>(
          DATABASE_ID,
          MEMBERS_ID,
          [Query.equal("workspaceId", workspaceId)]
        );
        for (const m of wsMembers.documents) {
          await databases.deleteDocument(DATABASE_ID, MEMBERS_ID, m.id);
        }
      } catch (err) {
        console.warn("Notice during workspace cascade cleanup:", err);
      }

      await databases.deleteDocument(
        DATABASE_ID,
        WORKSPACES_ID,
        workspaceId,
      );

      return c.json({ data: { $id: workspaceId, id: workspaceId } });
    }
  )
  .post(
    "/:workspaceId/transfer-ownership",
    sessionMiddleware,
    zValidator("json", z.object({ targetMemberId: z.string() })),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workspaceId } = c.req.param();
      const { targetMemberId } = c.req.valid("json");

      const currentProfile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!currentProfile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(currentProfile, "workspace:delete")) return deny(c, "workspace:delete"); // owner-only via engine

      const targetMember = await databases.getDocument<Member>(
        DATABASE_ID,
        MEMBERS_ID,
        targetMemberId
      );

      if (!targetMember || targetMember.workspaceId !== workspaceId) {
        return c.json({ error: "Target member not found in this workspace" }, 404);
      }

      const currentMemberId = currentProfile.id;
      const targetId = targetMember.$id || targetMember.id;

      if (targetId === currentMemberId) {
        return c.json({ error: "Cannot transfer ownership to yourself" }, 400);
      }

      // Demote current owner to ADMIN
      await databases.updateDocument(
        DATABASE_ID,
        MEMBERS_ID,
        currentMemberId,
        { role: MemberRole.ADMIN }
      );

      // Promote target member to OWNER
      await databases.updateDocument(
        DATABASE_ID,
        MEMBERS_ID,
        targetId,
        { role: MemberRole.OWNER }
      );

      return c.json({ success: true, message: "Ownership transferred successfully" });
    }
  )
  .post(
    "/:workspaceId/reset-invite-code",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { workspaceId } = c.req.param();

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "workspace:invite_code.manage")) return deny(c, "workspace:invite_code.manage");

      const workspace = await databases.updateDocument(
        DATABASE_ID,
        WORKSPACES_ID,
        workspaceId,
        {
          inviteCode: generateInviteCode(6),
        },
      );

      return c.json({ data: workspace });
    }
  )
  .get(
    "/lookup-invite",
    sessionMiddleware,
    zValidator("query", z.object({ code: z.string().min(1) })),
    async (c) => {
      const adminDatabases = getAdminDatabases("workspaces:lookup-invite");
      const { code } = c.req.valid("query");

      const workspaces = await adminDatabases.listDocuments<Workspace>(
        DATABASE_ID,
        WORKSPACES_ID,
        [Query.equal("inviteCode", code.trim()), Query.limit(1)]
      );

      if (workspaces.total === 0) {
        return c.json({ error: "Invalid or expired invite code" }, 404);
      }

      const workspace = workspaces.documents[0];
      return c.json({
        data: {
          $id: workspace.$id,
          id: workspace.id || workspace.$id,
          name: workspace.name,
          imageUrl: workspace.imageUrl,
          inviteCode: workspace.inviteCode,
        },
      });
    }
  )
  .post(
    "/:workspaceId/join",
    sessionMiddleware,
    zValidator("json", z.object({ code: z.string() })),
    async (c) => {
      const { workspaceId } = c.req.param();
      const { code } = c.req.valid("json");

      const databases = c.get("databases");
      const adminDatabases = getAdminDatabases("workspaces:join");
      const user = c.get("user");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (member) {
        return c.json({ error: "Already a member" }, 400);
      }

      const workspace = await adminDatabases.getDocument<Workspace>(
        DATABASE_ID,
        WORKSPACES_ID,
        workspaceId
      );

      if (workspace.inviteCode !== code) {
        return c.json({ error: "Invalid invite code" }, 400);
      }

      // DENY BY DEFAULT: new joiners are VIEWER unless an invite_link sets a role.
      // Role comes ONLY from the invite_links table — never from the request body.
      let assignedRole: MemberRole = MemberRole.VIEWER;
      let assignedRoleId: string | null = null;

      try {
        // Check for a matching email invite (invite_links table)
        const matchingInvites = await adminDatabases.listDocuments<Record<string, unknown>>(
          DATABASE_ID,
          "invitations",
          [
            Query.equal("workspaceId", workspaceId),
            Query.equal("email", user.email?.toLowerCase() || ""),
            Query.equal("status", "pending"),
            Query.limit(1),
          ]
        );
        if (matchingInvites.total > 0) {
          const invite = matchingInvites.documents[0];
          // Validate the role string is a real MemberRole enum value
          const inviteRole = String(invite.role || "");
          if (inviteRole && Object.values(MemberRole).includes(inviteRole as MemberRole) && inviteRole !== MemberRole.OWNER) {
            assignedRole = inviteRole as MemberRole;
          }
          // If the invite carries a roleId (from roles table), use it
          if (invite.roleId && typeof invite.roleId === "string") {
            assignedRoleId = invite.roleId;
          }
          await adminDatabases.updateDocument(DATABASE_ID, "invitations", String(invite.id), {
            status: "accepted",
          });
        }
      } catch {
        // Fallback or table not yet migrated — stays VIEWER
      }

      await databases.createDocument(
        DATABASE_ID,
        MEMBERS_ID,
        ID.unique(),
        {
          workspaceId,
          userId: user.$id,
          role: assignedRole,
          ...(assignedRoleId ? { roleId: assignedRoleId } : {}),
        },
      );

      return c.json({
        data: {
          $id: workspace.$id,
          id: workspace.id || workspace.$id,
          name: workspace.name,
          imageUrl: workspace.imageUrl,
        },
      });
    }
  )
  .get(
    "/:workspaceId/invites",
    sessionMiddleware,
    async (c) => {
      const { workspaceId } = c.req.param();
      const user = c.get("user");
      const databases = c.get("databases");
      const adminDatabases = getAdminDatabases("workspaces:invites.list");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "invites:manage")) return deny(c, "invites:manage");

      try {
        const invites = await adminDatabases.listDocuments<{
          id: string;
          workspaceId: string;
          email: string;
          role: MemberRole;
          code: string;
          status: string;
          created_at: string;
        }>(
          DATABASE_ID,
          "invitations",
          [
            Query.equal("workspaceId", workspaceId),
            Query.equal("status", "pending"),
            Query.orderDesc("created_at"),
          ]
        );

        return c.json({ data: invites.documents });
      } catch {
        return c.json({
          data: [] as Array<{
            id: string;
            workspaceId: string;
            email: string;
            role: MemberRole;
            code: string;
            status: string;
            created_at: string;
          }>,
        });
      }
    }
  )
  .post(
    "/:workspaceId/invites",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        email: z.string().email(),
        role: z.nativeEnum(MemberRole).default(MemberRole.MEMBER),
      })
    ),
    async (c) => {
      const { workspaceId } = c.req.param();
      const { email, role } = c.req.valid("json");
      const user = c.get("user");
      const databases = c.get("databases");
      const adminDatabases = getAdminDatabases("workspaces:invites.create");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "invites:manage")) return deny(c, "invites:manage");
      if (role === MemberRole.OWNER) {
        return c.json({ error: "Cannot invite a member as OWNER. Use transfer ownership instead." }, 400);
      }
      // Anti-escalation: cannot invite to role at or above own level
      const isOwner = profile.isWorkspaceOwner === true || (profile.role.isSystem && profile.role.level === 0);
      if (!isOwner) {
        const roleLevelMap: Record<MemberRole, number> = {
          [MemberRole.OWNER]: 0,
          [MemberRole.ADMIN]: 10,
          [MemberRole.PROJECT_MANAGER]: 30,
          [MemberRole.MEMBER]: 50,
          [MemberRole.VIEWER]: 80,
          [MemberRole.GUEST]: 90,
        };
        const targetLevel = roleLevelMap[role] ?? 50;
        if (targetLevel <= profile.role.level) {
          return c.json({ error: "Cannot invite to a role at or above your own level" }, 403);
        }
      }

      const workspace = await adminDatabases.getDocument<Workspace>(
        DATABASE_ID,
        WORKSPACES_ID,
        workspaceId
      );

      const inviteCode = workspace.inviteCode;
      const inviteId = ID.unique();

      try {
        const newInvite = await adminDatabases.createDocument(
          DATABASE_ID,
          "invitations",
          inviteId,
          {
            workspaceId,
            email: email.toLowerCase().trim(),
            role,
            code: inviteCode,
            inviterId: profile.id,
            status: "pending",
          }
        );

        return c.json({ data: newInvite });
      } catch {
        // Fallback response if table not yet run in Supabase SQL editor
        return c.json({
          data: {
            $id: inviteId,
            id: inviteId,
            workspaceId,
            email: email.toLowerCase().trim(),
            role,
            code: inviteCode,
            status: "pending",
            created_at: new Date().toISOString(),
          },
        });
      }
    }
  )
  .delete(
    "/:workspaceId/invites/:inviteId",
    sessionMiddleware,
    async (c) => {
      const { workspaceId, inviteId } = c.req.param();
      const user = c.get("user");
      const databases = c.get("databases");
      const adminDatabases = getAdminDatabases("workspaces:invites.delete");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "invites:manage")) return deny(c, "invites:manage");

      try {
        await adminDatabases.deleteDocument(DATABASE_ID, "invitations", inviteId);
      } catch {
        // ignore
      }

      return c.json({ data: { id: inviteId } });
    }
  )
  .get(
    "/:workspaceId/analytics",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workspaceId } = c.req.param();

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      if (!can(profile, "reports:view")) {
        return deny(c, "reports:view");
      }

      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      const thisMonthTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
        ]
      );

      const lastMonthTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
        ]
      );

      const taskCount = thisMonthTasks.total;
      const taskDifference = taskCount - lastMonthTasks.total;

      const thisMonthAssignedTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.equal("assigneeId", profile.id),
          Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
        ]
      );

      const lastMonthAssignedTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.equal("assigneeId", profile.id),
          Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
        ]
      );

      const assignedTaskCount = thisMonthAssignedTasks.total;
      const assignedTaskDifference =
        assignedTaskCount - lastMonthAssignedTasks.total;

      const thisMonthIncompleteTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.notEqual("status", TaskStatus.DONE),
          Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
        ]
      );

      const lastMonthIncompleteTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.notEqual("status", TaskStatus.DONE),
          Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
        ]
      );

      const incompleteTaskCount = thisMonthIncompleteTasks.total;
      const incompleteTaskDifference =
        incompleteTaskCount - lastMonthIncompleteTasks.total;

      const thisMonthCompletedTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.equal("status", TaskStatus.DONE),
          Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
        ]
      );

      const lastMonthCompletedTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.equal("status", TaskStatus.DONE),
          Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
        ]
      );

      const completedTaskCount = thisMonthCompletedTasks.total;
      const completedTaskDifference =
        completedTaskCount - lastMonthCompletedTasks.total;

      const thisMonthOverdueTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.notEqual("status", TaskStatus.DONE),
          Query.lessThan("dueDate", now.toISOString()),
          Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
        ]
      );

      const lastMonthOverdueTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.notEqual("status", TaskStatus.DONE),
          Query.lessThan("dueDate", now.toISOString()),
          Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
        ]
      );

      const overdueTaskCount = thisMonthOverdueTasks.total;
      const overdueTaskDifference =
        overdueTaskCount - lastMonthOverdueTasks.total;

      return c.json({
        data: {
          taskCount,
          taskDifference,
          assignedTaskCount,
          assignedTaskDifference,
          completedTaskCount,
          completedTaskDifference,
          incompleteTaskCount,
          incompleteTaskDifference,
          overdueTaskCount,
          overdueTaskDifference,
        },
      });
    }
  )

export default app;
