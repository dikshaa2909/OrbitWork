import { DocumentModel } from "@/lib/supabase";

export type WorkspaceType = "STARTUP" | "COLLEGE";

export type Workspace = DocumentModel & {
  name: string;
  imageUrl: string;
  inviteCode: string;
  userId: string;
  type?: WorkspaceType;
};
