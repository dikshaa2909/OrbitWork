import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";

import { ID, Query, DocumentModel, createAdminClient } from "@/lib/supabase";

import { TaskStatus } from "@/features/tasks/types";
import { getMember } from "@/features/members/utils";
import { Member } from "@/features/members/types";

import {
  DATABASE_ID,
  IMAGES_BUCKET_ID,
  MEMBERS_ID,
  PROJECT_MEMBERS_ID,
  PROJECTS_ID,
  ROLES_ID,
  SPRINTS_ID,
  TASKS_ID,
} from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";
import { Context } from "hono";
import { can } from "@/lib/permissions/engine";
import { getMemberPermissionProfile, logPermissionAudit } from "@/lib/permissions/server";
import { Role } from "@/features/roles/types";

import { createProjectSchema, updateProjectSchema } from "../schemas";

import { Project } from "../types";

const deny = (c: Context, key: string) =>
  c.json({ error: `Forbidden: '${key}' permission required`, requiredPermission: key, canRequest: true }, 403);

const app = new Hono()
  .post(
    "/",
    sessionMiddleware,
    zValidator("form", createProjectSchema),
    async (c) => {
      const databases = c.get("databases");
      const storage = c.get("storage");
      const user = c.get("user");

      const { name, image, workspaceId } = c.req.valid("form");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "projects:create")) return deny(c, "projects:create");

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

      const project = await databases.createDocument(
        DATABASE_ID,
        PROJECTS_ID,
        ID.unique(),
        {
          name,
          imageUrl: uploadedImageUrl,
          workspaceId
        },
      );

      return c.json({ data: project });
    }
  )
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");

      const { workspaceId } = c.req.valid("query");

      if (!workspaceId) {
        return c.json({ error: "Missing workspaceId" }, 400);
      }

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const projects = await databases.listDocuments<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        [
          Query.equal("workspaceId", workspaceId),
          Query.orderDesc("created_at"),
        ],
      );

      return c.json({ data: projects });
    }
  )
  .get(
    "/:projectId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { projectId } = c.req.param();

      const project = await databases.getDocument<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectId,
      );

      const member = await getMember({
        databases,
        workspaceId: project.workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      return c.json({ data: project });
    }
  )
  .patch(
    "/:projectId",
    sessionMiddleware,
    zValidator("form", updateProjectSchema),
    async (c) => {
      const databases = c.get("databases");
      const storage = c.get("storage");
      const user = c.get("user");

      const { projectId } = c.req.param();
      const { name, image } = c.req.valid("form");

      const existingProject = await databases.getDocument<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectId,
      );

      const profile = await getMemberPermissionProfile(databases, existingProject.workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "projects:edit", { projectId })) return deny(c, "projects:edit");

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

      const project = await databases.updateDocument(
        DATABASE_ID,
        PROJECTS_ID,
        projectId,
        {
          name,
          imageUrl: uploadedImageUrl
        }
      );

      return c.json({ data: project });
    }
  )
  .delete(
    "/:projectId",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");

      const { projectId } = c.req.param();

      const existingProject = await databases.getDocument<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectId,
      );

      const profile = await getMemberPermissionProfile(databases, existingProject.workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "projects:delete", { projectId })) return deny(c, "projects:delete");

      // Clean up project tasks
      try {
        const projectTasks = await databases.listDocuments<DocumentModel>(
          DATABASE_ID,
          TASKS_ID,
          [Query.equal("projectId", projectId)]
        );
        for (const t of projectTasks.documents) {
          await databases.deleteDocument(DATABASE_ID, TASKS_ID, t.id);
        }

        // Clean up project sprints
        const projectSprints = await databases.listDocuments<DocumentModel>(
          DATABASE_ID,
          SPRINTS_ID,
          [Query.equal("projectId", projectId)]
        );
        for (const s of projectSprints.documents) {
          await databases.deleteDocument(DATABASE_ID, SPRINTS_ID, s.id);
        }
      } catch (err) {
        console.warn("Notice during project cascade cleanup:", err);
      }

      await databases.deleteDocument(
        DATABASE_ID,
        PROJECTS_ID,
        projectId,
      );

      return c.json({ data: { $id: existingProject.$id, id: existingProject.$id } });
    }
  )
  .get(
    "/:projectId/analytics",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { projectId } = c.req.param();

      const project = await databases.getDocument<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      );

      const member = await getMember({
        databases,
        workspaceId: project.workspaceId,
        userId: user.$id,
      });


      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
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
          Query.equal("projectId", projectId),
          Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
        ]
      );

      const lastMonthTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("projectId", projectId),
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
          Query.equal("projectId", projectId),
          Query.equal("assigneeId", member.$id),
          Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
        ]
      );

      const lastMonthAssignedTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("projectId", projectId),
          Query.equal("assigneeId", member.$id),
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
          Query.equal("projectId", projectId),
          Query.notEqual("status", TaskStatus.DONE),
          Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
        ]
      );

      const lastMonthIncompleteTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("projectId", projectId),
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
          Query.equal("projectId", projectId),
          Query.equal("status", TaskStatus.DONE),
          Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
          Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
        ]
      );

      const lastMonthCompletedTasks = await databases.listDocuments(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("projectId", projectId),
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
          Query.equal("projectId", projectId),
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
          Query.equal("projectId", projectId),
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
  // List project member overrides
  .get(
    "/:projectId/members",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { projectId } = c.req.param();

      const project = await databases.getDocument<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      );
      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const profile = await getMemberPermissionProfile(databases, project.workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { users } = await createAdminClient();

      try {
        const pmDocs = await databases.listDocuments<{
          id: string;
          projectId: string;
          memberId: string;
          roleId: string | null;
          created_at: string;
        }>(DATABASE_ID, PROJECT_MEMBERS_ID, [
          Query.equal("projectId", projectId),
        ]);

        const memberIds = pmDocs.documents.map((p) => p.memberId);
        const roleIds = pmDocs.documents
          .map((p) => p.roleId)
          .filter((id): id is string => Boolean(id));

        const [membersRes, rolesRes] = await Promise.all([
          memberIds.length > 0
            ? databases.listDocuments<Member>(DATABASE_ID, MEMBERS_ID, [
                Query.contains("id", memberIds),
              ])
            : { documents: [] },
          roleIds.length > 0
            ? databases.listDocuments<Role>(DATABASE_ID, ROLES_ID, [
                Query.contains("id", roleIds),
              ])
            : { documents: [] },
        ]);

        const rolesMap = new Map<string, Role>();
        for (const r of rolesRes.documents) {
          rolesMap.set(r.id || (r.$id as string), r);
        }

        const membersMap = new Map<string, Member>();
        await Promise.all(
          membersRes.documents.map(async (m) => {
            const mId = m.id || (m.$id as string);
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

        const projectMembers = pmDocs.documents.map((pm) => {
          const pmId = pm.id || (pm as Record<string, unknown>).$id as string;
          return {
            id: pmId,
            projectId: pm.projectId,
            memberId: pm.memberId,
            roleId: pm.roleId,
            created_at: pm.created_at,
            member: membersMap.get(pm.memberId) || null,
            role: pm.roleId ? rolesMap.get(pm.roleId) || null : null,
          };
        });

        return c.json({ data: projectMembers });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load project members";
        return c.json({ error: message, data: [] }, 200);
      }
    }
  )
  // Set project member role override
  .post(
    "/:projectId/members",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        memberId: z.string(),
        roleId: z.string().nullable().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { projectId } = c.req.param();
      const { memberId, roleId } = c.req.valid("json");

      const project = await databases.getDocument<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      );
      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const profile = await getMemberPermissionProfile(databases, project.workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (
        !can(profile, "projects:members.manage", { projectId }) &&
        !can(profile, "projects:edit", { projectId }) &&
        profile.role.level > 10
      ) {
        return c.json({ error: "Forbidden: cannot manage project members" }, 403);
      }

      // Check existing project_member
      const existing = await databases.listDocuments<{ id?: string; $id?: string }>(
        DATABASE_ID,
        PROJECT_MEMBERS_ID,
        [
          Query.equal("projectId", projectId),
          Query.equal("memberId", memberId),
        ]
      );

      let record;
      if (existing.total > 0) {
        const existingId = (existing.documents[0].id || existing.documents[0].$id) as string;
        record = await databases.updateDocument(
          DATABASE_ID,
          PROJECT_MEMBERS_ID,
          existingId,
          { roleId: roleId || null }
        );
      } else {
        record = await databases.createDocument(
          DATABASE_ID,
          PROJECT_MEMBERS_ID,
          ID.unique(),
          {
            projectId,
            memberId,
            roleId: roleId || null,
          }
        );
      }

      await logPermissionAudit(databases, {
        workspaceId: project.workspaceId,
        actorMemberId: profile.id,
        action: "ASSIGN",
        entityType: "PROJECT_OVERRIDE",
        entityId: memberId,
        newValues: { projectId, roleId },
      });

      return c.json({ data: record });
    }
  )
  // Remove project member override (reverts to workspace role)
  .delete(
    "/:projectId/members/:memberId",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { projectId, memberId } = c.req.param();

      const project = await databases.getDocument<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectId
      );
      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const profile = await getMemberPermissionProfile(databases, project.workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (
        !can(profile, "projects:members.manage", { projectId }) &&
        !can(profile, "projects:edit", { projectId }) &&
        profile.role.level > 10
      ) {
        return c.json({ error: "Forbidden: cannot manage project members" }, 403);
      }

      const existing = await databases.listDocuments<{ id?: string; $id?: string }>(
        DATABASE_ID,
        PROJECT_MEMBERS_ID,
        [
          Query.equal("projectId", projectId),
          Query.equal("memberId", memberId),
        ]
      );

      for (const doc of existing.documents) {
        const docId = (doc.id || doc.$id) as string;
        if (docId) {
          await databases.deleteDocument(DATABASE_ID, PROJECT_MEMBERS_ID, docId);
        }
      }

      await logPermissionAudit(databases, {
        workspaceId: project.workspaceId,
        actorMemberId: profile.id,
        action: "DELETE",
        entityType: "PROJECT_OVERRIDE",
        entityId: memberId,
        oldValues: { projectId },
      });

      return c.json({ data: { projectId, memberId } });
    }
  );

export default app;
