import { DocumentModel } from "@/lib/supabase";

export enum NotificationType {
  TASK_ASSIGNED = "TASK_ASSIGNED",
  TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED",
  TASK_COMMENTED = "TASK_COMMENTED",
  TASK_MENTIONED = "TASK_MENTIONED",
  SYSTEM = "SYSTEM",
}

export type Notification = DocumentModel & {
  recipientId: string;
  workspaceId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  taskId?: string | null;
  isRead: boolean;
};
