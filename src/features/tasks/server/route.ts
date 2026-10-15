import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { getMember } from "@/features/members/utils";
import { Member } from "@/features/members/types";
import { Project } from "@/features/projects/types";

import { createAdminClient, ID, Query } from "@/lib/supabase";
import { sessionMiddleware } from "@/lib/session-middleware";
import { Context } from "hono";
import { can } from "@/lib/permissions/engine";
import { getMemberPermissionProfile } from "@/lib/permissions/server";
import {
  COMMENTS_ID,
  DATABASE_ID,
  LABELS_ID,
  MEMBERS_ID,
  PROJECTS_ID,
  TASK_ACTIVITY_ID,
  TASK_LINKS_ID,
  TASKS_ID,
} from "@/config";

import {
  Comment,
  Label,
  Task,
  TaskActivity,
  TaskLink,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "../types";
import {
  createCommentSchema,
  createLabelSchema,
  createTaskLinkSchema,
  createTaskSchema,
  updateTaskSchema,
} from "../schemas";

const deny = (c: Context, key: string) =>
  c.json({ error: `Forbidden: '${key}' permission required`, requiredPermission: key, canRequest: true }, 403);

const app = new Hono()
  .delete("/:taskId", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { taskId } = c.req.param();

    const task = await databases.getDocument<Task>(
      DATABASE_ID,
      TASKS_ID,
      taskId
    );

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    const profile = await getMemberPermissionProfile(databases, task.workspaceId, user.$id);
    if (!profile) return c.json({ error: "Unauthorized" }, 401);

    const allowed = can(profile, "tasks:delete.any", {
      projectId: task.projectId,
      resource: { reporterId: task.reporterId, assigneeId: task.assigneeId },
    });

    if (!allowed) {
      return deny(c, "tasks:delete.any");
    }

    await databases.deleteDocument(DATABASE_ID, TASKS_ID, taskId);

    return c.json({ data: { $id: task.$id, id: task.$id } });
  })
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        projectId: z.string().nullish(),
        assigneeId: z.string().nullish(),
        status: z.nativeEnum(TaskStatus).nullish(),
        type: z.nativeEnum(TaskType).nullish(),
        priority: z.nativeEnum(TaskPriority).nullish(),
        sprintId: z.string().nullish(),
        parentId: z.string().nullish(),
        search: z.string().nullish(),
        dueDate: z.string().nullish(),
      })
    ),
    async (c) => {
      const { users } = await createAdminClient();
      const databases = c.get("databases");
      const user = c.get("user");

      const {
        workspaceId,
        projectId,
        status,
        type,
        priority,
        sprintId,
        parentId,
        search,
        assigneeId,
        dueDate,
      } = c.req.valid("query");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const query = [
        Query.equal("workspaceId", workspaceId),
        Query.orderDesc("created_at"),
      ];

      if (projectId) {
        query.push(Query.equal("projectId", projectId));
      }

      if (status) {
        query.push(Query.equal("status", status));
      }

      if (type) {
        query.push(Query.equal("type", type));
      }

      if (priority) {
        query.push(Query.equal("priority", priority));
      }

      if (sprintId) {
        query.push(Query.equal("sprintId", sprintId));
      }

      if (parentId) {
        query.push(Query.equal("parentId", parentId));
      }

      if (assigneeId) {
        query.push(Query.equal("assigneeId", assigneeId));
      }

      if (dueDate) {
        query.push(Query.equal("dueDate", dueDate));
      }

      if (search) {
        query.push(Query.search("name", search));
      }

      // Scope to assigned tasks if member cannot view all tasks
      if (!can(profile, "tasks:view.all", { projectId: projectId || undefined })) {
        query.push(Query.equal("assigneeId", profile.id));
      }

      const tasks = await databases.listDocuments<Task>(
        DATABASE_ID,
        TASKS_ID,
        query
      );

      const projectIds = tasks.documents.map((task) => task.projectId);
      const assigneeIds = tasks.documents.map((task) => task.assigneeId);

      const projects = await databases.listDocuments<Project>(
        DATABASE_ID,
        PROJECTS_ID,
        projectIds.length > 0 ? [Query.contains("id", projectIds)] : []
      );

      const members = await databases.listDocuments<Member>(
        DATABASE_ID,
        MEMBERS_ID,
        assigneeIds.length > 0 ? [Query.contains("id", assigneeIds)] : []
      );

      const assignees = await Promise.all(
        members.documents.map(async (member) => {
          const u = await users.get(member.userId);
          return {
            ...member,
            name: u.name || u.email,
            email: u.email,
          };
        })
      );

      const populatedTasks = tasks.documents.map((task) => {
        const project = projects.documents.find(
          (p) => p.$id === task.projectId || p.id === task.projectId
        );
        const assignee = assignees.find(
          (a) => a.$id === task.assigneeId || a.id === task.assigneeId
        );

        return {
          ...task,
          project: project!,
          assignee: assignee!,
        };
      });

      return c.json({
        data: {
          ...tasks,
          documents: populatedTasks,
        },
      });
    }
  )
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createTaskSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const {
        name,
        status,
        workspaceId,
        projectId,
        dueDate,
        assigneeId,
        description,
        type,
        priority,
        parentId,
        reporterId,
        storyPoints,
        estimatedHours,
        sprintId,
      } = c.req.valid("json");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "tasks:create", { projectId })) {
        return deny(c, "tasks:create");
      }

      const highestPositionTask = await databases.listDocuments<Task>(
        DATABASE_ID,
        TASKS_ID,
        [
          Query.equal("status", status),
          Query.equal("workspaceId", workspaceId),
          Query.orderAsc("position"),
          Query.limit(1),
        ]
      );

      const newPosition =
        highestPositionTask.documents.length > 0
          ? highestPositionTask.documents[0].position + 1000
          : 1000;

      const task = await databases.createDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        ID.unique(),
        {
          name,
          status,
          workspaceId,
          projectId,
          dueDate: typeof dueDate === "string" ? dueDate : dueDate.toISOString(),
          assigneeId,
          position: newPosition,
          description: description || null,
          type: type || TaskType.TASK,
          priority: priority || TaskPriority.MEDIUM,
          parentId: parentId || null,
          reporterId: reporterId || profile.id,
          storyPoints: storyPoints || null,
          estimatedHours: estimatedHours || null,
          sprintId: sprintId || null,
        }
      );

      // Record activity
      try {
        await databases.createDocument(
          DATABASE_ID,
          TASK_ACTIVITY_ID,
          ID.unique(),
          {
            taskId: task.$id,
            memberId: profile.id,
            action: "CREATED",
            field: null,
            oldValue: null,
            newValue: task.name,
          }
        );
      } catch {
        // Activity log optional fallback
      }

      return c.json({ data: task });
    }
  )
  .patch(
    "/:taskId",
    sessionMiddleware,
    zValidator("json", updateTaskSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const updates = c.req.valid("json");
      const { taskId } = c.req.param();

      const existingTask = await databases.getDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId
      );

      if (!existingTask) {
        return c.json({ error: "Task not found" }, 404);
      }

      const profile = await getMemberPermissionProfile(databases, existingTask.workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const canEdit = can(profile, "tasks:edit.any", {
        projectId: existingTask.projectId,
        resource: {
          reporterId: existingTask.reporterId,
          assigneeId: existingTask.assigneeId,
        },
      });

      if (!canEdit) {
        return deny(c, "tasks:edit.any");
      }

      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.projectId !== undefined) payload.projectId = updates.projectId;
      if (updates.dueDate !== undefined) {
        payload.dueDate =
          typeof updates.dueDate === "string"
            ? updates.dueDate
            : updates.dueDate.toISOString();
      }
      if (updates.assigneeId !== undefined) payload.assigneeId = updates.assigneeId;
      if (updates.type !== undefined) payload.type = updates.type;
      if (updates.priority !== undefined) payload.priority = updates.priority;
      if (updates.parentId !== undefined) payload.parentId = updates.parentId;
      if (updates.reporterId !== undefined) payload.reporterId = updates.reporterId;
      if (updates.storyPoints !== undefined) payload.storyPoints = updates.storyPoints;
      if (updates.estimatedHours !== undefined) payload.estimatedHours = updates.estimatedHours;
      if (updates.sprintId !== undefined) payload.sprintId = updates.sprintId;

      const task = await databases.updateDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId,
        payload
      );

      // Record status change activity if changed
      if (updates.status && updates.status !== existingTask.status) {
        try {
          await databases.createDocument(
            DATABASE_ID,
            TASK_ACTIVITY_ID,
            ID.unique(),
            {
              taskId,
              memberId: profile.id,
              action: "STATUS_CHANGED",
              field: "status",
              oldValue: existingTask.status,
              newValue: updates.status,
            }
          );
        } catch {
          // ignore activity error
        }
      }

      return c.json({ data: task });
    }
  )
  .get("/:taskId", sessionMiddleware, async (c) => {
    const currentUser = c.get("user");
    const databases = c.get("databases");
    const { users } = await createAdminClient();
    const { taskId } = c.req.param();

    const task = await databases.getDocument<Task>(
      DATABASE_ID,
      TASKS_ID,
      taskId
    );

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    const profile = await getMemberPermissionProfile(databases, task.workspaceId, currentUser.$id);
    if (!profile) return c.json({ error: "Unauthorized" }, 401);

    if (
      !can(profile, "tasks:view.all", {
        projectId: task.projectId,
        resource: { assigneeId: task.assigneeId, reporterId: task.reporterId },
      })
    ) {
      return deny(c, "tasks:view.all");
    }

    const project = await databases.getDocument<Project>(
      DATABASE_ID,
      PROJECTS_ID,
      task.projectId
    );

    const member = await databases.getDocument<Member>(
      DATABASE_ID,
      MEMBERS_ID,
      task.assigneeId
    );

    const u = await users.get(member.userId);
    const assignee = {
      ...member,
      name: u.name || u.email,
      email: u.email,
    };

    return c.json({
      data: {
        ...task,
        project,
        assignee,
      },
    });
  })
  .post(
    "/bulk-update",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        tasks: z.array(
          z.object({
            $id: z.string().optional(),
            id: z.string().optional(),
            status: z.nativeEnum(TaskStatus),
            position: z.number().int().positive().min(1000).max(1_000_000),
          })
        ),
      })
    ),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { tasks } = c.req.valid("json");

      const taskIds = tasks.map((t) => t.$id || t.id || "").filter(Boolean);

      const tasksToUpdate = await databases.listDocuments<Task>(
        DATABASE_ID,
        TASKS_ID,
        [Query.contains("$id", taskIds)]
      );

      const workspaceIds = new Set(
        tasksToUpdate.documents.map((task) => task.workspaceId)
      );
      if (workspaceIds.size !== 1) {
        return c.json({ error: "All tasks must belong to the same workspace" });
      }

      const workspaceId = workspaceIds.values().next().value;
      if (!workspaceId) {
        return c.json({ error: "Workspace ID is required" }, 400);
      }

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      if (!can(profile, "tasks:bulk_edit") && !can(profile, "tasks:transition")) {
        return deny(c, "tasks:transition");
      }

      const updatedTasks = await Promise.all(
        tasks.map(async (task) => {
          const taskId = task.$id || task.id;
          if (!taskId) return null;
          return databases.updateDocument<Task>(
            DATABASE_ID,
            TASKS_ID,
            taskId,
            { status: task.status, position: task.position }
          );
        })
      );

      return c.json({ data: updatedTasks.filter(Boolean) });
    }
  )
  // Comments endpoints
  .get("/:taskId/comments", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { users } = await createAdminClient();
    const { taskId } = c.req.param();

    const task = await databases.getDocument<Task>(
      DATABASE_ID,
      TASKS_ID,
      taskId
    );

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    const member = await getMember({
      databases,
      workspaceId: task.workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const comments = await databases.listDocuments<Comment>(
      DATABASE_ID,
      COMMENTS_ID,
      [Query.equal("taskId", taskId), Query.orderAsc("created_at")]
    );

    const authorIds = comments.documents.map((c) => c.authorId);
    const members = await databases.listDocuments<Member>(
      DATABASE_ID,
      MEMBERS_ID,
      authorIds.length > 0 ? [Query.contains("id", authorIds)] : []
    );

    const populatedComments = await Promise.all(
      comments.documents.map(async (comment) => {
        const authorMember = members.documents.find(
          (m) => m.$id === comment.authorId || m.id === comment.authorId
        );
        let authorData = authorMember;
        if (authorMember) {
          const u = await users.get(authorMember.userId);
          authorData = {
            ...authorMember,
            name: u.name || u.email,
            email: u.email,
          };
        }
        return {
          ...comment,
          author: authorData,
        };
      })
    );

    return c.json({ data: { documents: populatedComments, total: populatedComments.length } });
  })
  .post(
    "/:taskId/comments",
    sessionMiddleware,
    zValidator("json", createCommentSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { taskId } = c.req.param();
      const { content } = c.req.valid("json");

      const task = await databases.getDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId
      );

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const profile = await getMemberPermissionProfile(databases, task.workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      if (!can(profile, "comments:create", { projectId: task.projectId })) {
        return deny(c, "comments:create");
      }

      const comment = await databases.createDocument<Comment>(
        DATABASE_ID,
        COMMENTS_ID,
        ID.unique(),
        {
          taskId,
          authorId: profile.id,
          content,
        }
      );

      // Record activity
      try {
        await databases.createDocument(
          DATABASE_ID,
          TASK_ACTIVITY_ID,
          ID.unique(),
          {
            taskId,
            memberId: profile.id,
            action: "COMMENT_ADDED",
            field: "comment",
            oldValue: null,
            newValue: content.slice(0, 50),
          }
        );
      } catch {
        // ignore activity error
      }

      return c.json({ data: comment });
    }
  )
  .delete("/:taskId/comments/:commentId", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { taskId, commentId } = c.req.param();

    const task = await databases.getDocument<Task>(
      DATABASE_ID,
      TASKS_ID,
      taskId
    );

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    const profile = await getMemberPermissionProfile(databases, task.workspaceId, user.$id);
    if (!profile) return c.json({ error: "Unauthorized" }, 401);

    const comment = await databases.getDocument<Comment>(
      DATABASE_ID,
      COMMENTS_ID,
      commentId
    );

    if (!comment) {
      return c.json({ error: "Comment not found" }, 404);
    }

    const canDeleteComment = can(profile, "comments:delete.any", {
      projectId: task.projectId,
      resource: { authorId: comment.authorId },
    });

    if (!canDeleteComment) {
      return deny(c, "comments:delete.any");
    }

    await databases.deleteDocument(DATABASE_ID, COMMENTS_ID, commentId);

    return c.json({ data: { $id: commentId, id: commentId } });
  })
  // Activity log endpoint
  .get("/:taskId/activity", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { users } = await createAdminClient();
    const { taskId } = c.req.param();

    const task = await databases.getDocument<Task>(
      DATABASE_ID,
      TASKS_ID,
      taskId
    );

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    const member = await getMember({
      databases,
      workspaceId: task.workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const activity = await databases.listDocuments<TaskActivity>(
      DATABASE_ID,
      TASK_ACTIVITY_ID,
      [Query.equal("taskId", taskId), Query.orderDesc("created_at")]
    );

    const memberIds = activity.documents.map((a) => a.memberId);
    const members = await databases.listDocuments<Member>(
      DATABASE_ID,
      MEMBERS_ID,
      memberIds.length > 0 ? [Query.contains("id", memberIds)] : []
    );

    const populatedActivity = await Promise.all(
      activity.documents.map(async (act) => {
        const mem = members.documents.find(
          (m) => m.$id === act.memberId || m.id === act.memberId
        );
        let memData = mem;
        if (mem) {
          const u = await users.get(mem.userId);
          memData = {
            ...mem,
            name: u.name || u.email,
            email: u.email,
          };
        }
        return {
          ...act,
          member: memData,
        };
      })
    );

    return c.json({ data: { documents: populatedActivity, total: populatedActivity.length } });
  })
  // Task Links endpoints
  .get("/:taskId/links", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { taskId } = c.req.param();

    const task = await databases.getDocument<Task>(
      DATABASE_ID,
      TASKS_ID,
      taskId
    );

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    const member = await getMember({
      databases,
      workspaceId: task.workspaceId,
      userId: user.$id,
    });

    if (!member) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const links = await databases.listDocuments<TaskLink>(
      DATABASE_ID,
      TASK_LINKS_ID,
      [Query.equal("sourceTaskId", taskId)]
    );

    const targetIds = links.documents.map((l) => l.targetTaskId);
    const targetTasks = await databases.listDocuments<Task>(
      DATABASE_ID,
      TASKS_ID,
      targetIds.length > 0 ? [Query.contains("$id", targetIds)] : []
    );

    const populatedLinks = links.documents.map((link) => ({
      ...link,
      targetTask: targetTasks.documents.find(
        (t) => t.$id === link.targetTaskId || t.id === link.targetTaskId
      ),
    }));

    return c.json({ data: { documents: populatedLinks, total: populatedLinks.length } });
  })
  .post(
    "/:taskId/links",
    sessionMiddleware,
    zValidator("json", createTaskLinkSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { taskId } = c.req.param();
      const { targetTaskId, linkType } = c.req.valid("json");

      const task = await databases.getDocument<Task>(
        DATABASE_ID,
        TASKS_ID,
        taskId
      );

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const profile = await getMemberPermissionProfile(databases, task.workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      if (!can(profile, "tasks:edit.any", { projectId: task.projectId })) {
        return deny(c, "tasks:edit.any");
      }

      const link = await databases.createDocument<TaskLink>(
        DATABASE_ID,
        TASK_LINKS_ID,
        ID.unique(),
        {
          sourceTaskId: taskId,
          targetTaskId,
          linkType,
        }
      );

      return c.json({ data: link });
    }
  )
  .delete("/:taskId/links/:linkId", sessionMiddleware, async (c) => {
    const user = c.get("user");
    const databases = c.get("databases");
    const { taskId, linkId } = c.req.param();

    const task = await databases.getDocument<Task>(
      DATABASE_ID,
      TASKS_ID,
      taskId
    );

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    const profile = await getMemberPermissionProfile(databases, task.workspaceId, user.$id);
    if (!profile) return c.json({ error: "Unauthorized" }, 401);

    if (!can(profile, "tasks:edit.any", { projectId: task.projectId })) {
      return deny(c, "tasks:edit.any");
    }

    await databases.deleteDocument(DATABASE_ID, TASK_LINKS_ID, linkId);

    return c.json({ data: { $id: linkId, id: linkId } });
  })
  // Labels endpoints
  .get(
    "/workspace-labels",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const labels = await databases.listDocuments<Label>(
        DATABASE_ID,
        LABELS_ID,
        [Query.equal("workspaceId", workspaceId)]
      );

      return c.json({ data: labels });
    }
  )
  .post(
    "/workspace-labels",
    sessionMiddleware,
    zValidator("json", createLabelSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId, name, color } = c.req.valid("json");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      if (!can(profile, "tasks:edit.any")) {
        return deny(c, "tasks:edit.any");
      }

      const label = await databases.createDocument<Label>(
        DATABASE_ID,
        LABELS_ID,
        ID.unique(),
        {
          workspaceId,
          name,
          color,
        }
      );

      return c.json({ data: label });
    }
  );

export default app;
