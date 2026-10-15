import { DocumentModel } from "@/lib/supabase";
import { Member } from "@/features/members/types";
import { Project } from "@/features/projects/types";

export enum TaskStatus {
  BACKLOG = "BACKLOG",
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  IN_REVIEW = "IN_REVIEW",
  DONE = "DONE"
};

export enum TaskType {
  TASK = "TASK",
  BUG = "BUG",
  STORY = "STORY",
  EPIC = "EPIC",
  SUBTASK = "SUBTASK",
};

export enum TaskPriority {
  URGENT = "URGENT",
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
  NONE = "NONE",
};

export enum TaskLinkType {
  BLOCKS = "BLOCKS",
  BLOCKED_BY = "BLOCKED_BY",
  RELATES_TO = "RELATES_TO",
  DUPLICATES = "DUPLICATES",
  DUPLICATED_BY = "DUPLICATED_BY",
};

export type Label = DocumentModel & {
  workspaceId: string;
  name: string;
  color: string;
};

export type Comment = DocumentModel & {
  taskId: string;
  authorId: string;
  content: string;
  author?: Member;
};

export type TaskAttachment = DocumentModel & {
  taskId: string;
  uploaderId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploader?: Member;
};

export type TaskActivity = DocumentModel & {
  taskId: string;
  memberId: string;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  member?: Member;
};

export type TaskLink = DocumentModel & {
  sourceTaskId: string;
  targetTaskId: string;
  linkType: TaskLinkType;
  targetTask?: Task;
};

export type Task = DocumentModel & {
  name: string;
  status: TaskStatus;
  workspaceId: string;
  assigneeId: string;
  projectId: string;
  position: number;
  dueDate: string;
  description?: string;
  type?: TaskType;
  priority?: TaskPriority;
  parentId?: string | null;
  reporterId?: string | null;
  storyPoints?: number | null;
  estimatedHours?: number | null;
  sprintId?: string | null;
  project: Project;
  assignee: Member;
  reporter?: Member;
  parent?: Task;
  labels?: Label[];
  comments?: Comment[];
  attachments?: TaskAttachment[];
  links?: TaskLink[];
};
