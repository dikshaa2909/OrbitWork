import { z } from "zod";

export type ChannelType = "WORKSPACE" | "PROJECT" | "TEAM" | "PRIVATE" | "DM";
export type ChannelMemberRole = "OWNER" | "MODERATOR" | "MEMBER";

export interface Channel {
  id: string;
  workspace_id: string;
  type: ChannelType;
  name: string | null;
  description: string | null;
  project_id: string | null;
  team_id: string | null;
  created_by: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Joined/calculated attributes
  member_count?: number;
  unread_count?: number;
  last_message?: Message | null;
  dm_partner?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface ChannelMember {
  id: string;
  channel_id: string;
  member_id: string;
  role: ChannelMemberRole;
  last_read_message_id: string | null;
  muted_until: string | null;
  joined_at: string;
  member_name?: string;
  member_email?: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  member_id: string;
  emoji: string;
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  parent_message_id: string | null;
  body: string;
  edited_at: string | null;
  deleted_at: string | null;
  task_id: string | null;
  created_at: string;
  // Joined fields
  author_name?: string;
  author_email?: string;
  author_role?: string;
  author_role_label?: string;
  reactions?: MessageReaction[];
  reply_count?: number;
}

export const createChannelSchema = z.object({
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
  type: z.enum(["WORKSPACE", "PROJECT", "TEAM", "PRIVATE", "DM"]).default("PRIVATE"),
  name: z.string().trim().min(1, "Name is required").optional(),
  description: z.string().optional(),
  projectId: z.string().nullish(),
  teamId: z.string().nullish(),
  recipientMemberId: z.string().optional(), // For DM creation
});

export const createMessageSchema = z.object({
  body: z.string().trim().min(1, "Message content is required"),
  parentMessageId: z.string().nullish(),
  taskId: z.string().nullish(),
});

export const toggleReactionSchema = z.object({
  emoji: z.string().min(1, "Emoji is required"),
});

