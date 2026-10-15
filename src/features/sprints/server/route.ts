import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { DATABASE_ID, SPRINTS_ID } from "@/config";
import { ID, Query } from "@/lib/supabase";
import { sessionMiddleware } from "@/lib/session-middleware";
import { Context } from "hono";
import { getMember } from "@/features/members/utils";
import { can } from "@/lib/permissions/engine";
import { getMemberPermissionProfile } from "@/lib/permissions/server";

import { createSprintSchema, updateSprintSchema } from "../schemas";
import { Sprint, SprintStatus } from "../types";

const deny = (c: Context, key: string) =>
  c.json({ error: `Forbidden: '${key}' permission required`, requiredPermission: key, canRequest: true }, 403);

const app = new Hono()
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        projectId: z.string().nullish(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId, projectId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const queries = [
        Query.equal("workspaceId", workspaceId),
        Query.orderDesc("created_at"),
      ];

      if (projectId) {
        queries.push(Query.equal("projectId", projectId));
      }

      const sprints = await databases.listDocuments<Sprint>(
        DATABASE_ID,
        SPRINTS_ID,
        queries
      );

      return c.json({ data: sprints });
    }
  )
  .get("/:sprintId", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { sprintId } = c.req.param();

    const sprint = await databases.getDocument<Sprint>(
      DATABASE_ID,
      SPRINTS_ID,
      sprintId
    );

    if (!sprint) {
      return c.json({ error: "Sprint not found" }, 404);
    }

    const member = await getMember({
      databases,
      workspaceId: sprint.workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return c.json({ data: sprint });
  })
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createSprintSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId, projectId, name, goal, startDate, endDate } =
        c.req.valid("json");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "sprints:manage", { projectId: projectId || undefined })) {
        return deny(c, "sprints:manage");
      }

      const sprint = await databases.createDocument<Sprint>(
        DATABASE_ID,
        SPRINTS_ID,
        ID.unique(),
        {
          workspaceId,
          projectId: projectId || null,
          name,
          goal: goal || null,
          startDate: startDate ? startDate.toISOString() : null,
          endDate: endDate ? endDate.toISOString() : null,
          status: SprintStatus.PLANNING,
        }
      );

      return c.json({ data: sprint });
    }
  )
  .patch(
    "/:sprintId",
    sessionMiddleware,
    zValidator("json", updateSprintSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { sprintId } = c.req.param();
      const updates = c.req.valid("json");

      const sprint = await databases.getDocument<Sprint>(
        DATABASE_ID,
        SPRINTS_ID,
        sprintId
      );

      if (!sprint) {
        return c.json({ error: "Sprint not found" }, 404);
      }

      const profile = await getMemberPermissionProfile(databases, sprint.workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "sprints:manage", { projectId: sprint.projectId || undefined })) {
        return deny(c, "sprints:manage");
      }

      const updatedSprint = await databases.updateDocument<Sprint>(
        DATABASE_ID,
        SPRINTS_ID,
        sprintId,
        {
          ...(updates.name && { name: updates.name }),
          ...(updates.goal !== undefined && { goal: updates.goal }),
          ...(updates.startDate && { startDate: updates.startDate.toISOString() }),
          ...(updates.endDate && { endDate: updates.endDate.toISOString() }),
          ...(updates.status && { status: updates.status }),
        }
      );

      return c.json({ data: updatedSprint });
    }
  )
  .delete("/:sprintId", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { sprintId } = c.req.param();

    const sprint = await databases.getDocument<Sprint>(
      DATABASE_ID,
      SPRINTS_ID,
      sprintId
    );

    if (!sprint) {
      return c.json({ error: "Sprint not found" }, 404);
    }

    const profile = await getMemberPermissionProfile(databases, sprint.workspaceId, user.$id);
    if (!profile) return c.json({ error: "Unauthorized" }, 401);
    if (!can(profile, "sprints:manage", { projectId: sprint.projectId || undefined })) {
      return deny(c, "sprints:manage");
    }

    await databases.deleteDocument(DATABASE_ID, SPRINTS_ID, sprintId);

    return c.json({ data: { $id: sprintId, id: sprintId } });
  })
  .post("/:sprintId/start", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { sprintId } = c.req.param();

    const sprint = await databases.getDocument<Sprint>(
      DATABASE_ID,
      SPRINTS_ID,
      sprintId
    );

    if (!sprint) {
      return c.json({ error: "Sprint not found" }, 404);
    }

    const profile = await getMemberPermissionProfile(databases, sprint.workspaceId, user.$id);
    if (!profile) return c.json({ error: "Unauthorized" }, 401);
    if (!can(profile, "sprints:manage", { projectId: sprint.projectId || undefined })) {
      return deny(c, "sprints:manage");
    }

    const updatedSprint = await databases.updateDocument<Sprint>(
      DATABASE_ID,
      SPRINTS_ID,
      sprintId,
      {
        status: SprintStatus.ACTIVE,
        startDate: sprint.startDate || new Date().toISOString(),
      }
    );

    return c.json({ data: updatedSprint });
  })
  .post("/:sprintId/complete", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { sprintId } = c.req.param();

    const sprint = await databases.getDocument<Sprint>(
      DATABASE_ID,
      SPRINTS_ID,
      sprintId
    );

    if (!sprint) {
      return c.json({ error: "Sprint not found" }, 404);
    }

    const profile = await getMemberPermissionProfile(databases, sprint.workspaceId, user.$id);
    if (!profile) return c.json({ error: "Unauthorized" }, 401);
    if (!can(profile, "sprints:manage", { projectId: sprint.projectId || undefined })) {
      return deny(c, "sprints:manage");
    }

    const updatedSprint = await databases.updateDocument<Sprint>(
      DATABASE_ID,
      SPRINTS_ID,
      sprintId,
      {
        status: SprintStatus.COMPLETED,
        endDate: new Date().toISOString(),
      }
    );

    return c.json({ data: updatedSprint });
  });

export default app;
