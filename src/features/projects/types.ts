import { DocumentModel } from "@/lib/supabase";

export type Project = DocumentModel & {
  name: string;
  imageUrl: string;
  workspaceId: string;
};
