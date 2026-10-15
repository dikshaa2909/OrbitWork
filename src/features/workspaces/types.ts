import { DocumentModel } from "@/lib/supabase";

export type Workspace = DocumentModel & {
  name: string;
  imageUrl: string;
  inviteCode: string;
  userId: string;
};
