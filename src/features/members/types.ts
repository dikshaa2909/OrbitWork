import { DocumentModel } from "@/lib/supabase";

export enum MemberRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  PROJECT_MANAGER = "PROJECT_MANAGER",
  MEMBER = "MEMBER",
  VIEWER = "VIEWER",
  GUEST = "GUEST",
};

export type Member = DocumentModel & {
  workspaceId: string;
  userId: string;
  role: MemberRole;
  roleId?: string;
  roleName?: string;
  name: string;
  email: string;
};
