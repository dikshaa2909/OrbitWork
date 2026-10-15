import { DocumentModel } from "@/lib/supabase";

export enum SprintStatus {
  PLANNING = "PLANNING",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
}

export type Sprint = DocumentModel & {
  workspaceId: string;
  projectId?: string | null;
  name: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: SprintStatus;
};
