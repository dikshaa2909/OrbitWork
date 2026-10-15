import { z } from "zod";

import { TaskLinkType, TaskPriority, TaskStatus, TaskType } from "./types";

export const createTaskSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  status: z.nativeEnum(TaskStatus, { required_error: "Required" }),
  workspaceId: z.string().trim().min(1, "Required"),
  projectId: z.string().trim().min(1, "Required"),
  dueDate: z.coerce.date(),
  assigneeId: z.string().trim().min(1, "Required"),
  description: z.string().optional(),
  type: z.nativeEnum(TaskType).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  parentId: z.string().trim().nullish(),
  reporterId: z.string().trim().nullish(),
  storyPoints: z.coerce.number().int().min(0).nullish(),
  estimatedHours: z.coerce.number().min(0).nullish(),
  sprintId: z.string().trim().nullish(),
  labelIds: z.array(z.string()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  description: z.string().optional(),
});

export const createCommentSchema = z.object({
  taskId: z.string().trim().min(1, "Required"),
  content: z.string().trim().min(1, "Comment cannot be empty"),
});

export const createTaskLinkSchema = z.object({
  sourceTaskId: z.string().trim().min(1, "Required"),
  targetTaskId: z.string().trim().min(1, "Required"),
  linkType: z.nativeEnum(TaskLinkType, { required_error: "Required" }),
});

export const createLabelSchema = z.object({
  workspaceId: z.string().trim().min(1, "Required"),
  name: z.string().trim().min(1, "Name is required"),
  color: z.string().trim().min(1, "Color is required").default("#6366f1"),
});
