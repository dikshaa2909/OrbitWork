import { z } from "zod";
import { Member } from "@/features/members/types";

export interface Team {
  id: string;
  $id?: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  leadMemberId?: string | null;
  parentTeamId?: string | null;
  created_at: string;
  updated_at: string;
  memberCount?: number;
  leadMember?: Member | null;
  members?: Member[];
  parentTeam?: Team | null;
  subTeams?: Team[];
}

export interface TeamMember {
  id: string;
  $id?: string;
  teamId: string;
  memberId: string;
  created_at: string;
  member?: Member;
}

export const createTeamSchema = z.object({
  workspaceId: z.string(),
  name: z.string().trim().min(1, "Team name is required"),
  description: z.string().optional(),
  leadMemberId: z.string().nullish(),
  parentTeamId: z.string().nullish(),
});

export const updateTeamSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  leadMemberId: z.string().nullish(),
  parentTeamId: z.string().nullish(),
});

export const addTeamMemberSchema = z.object({
  memberId: z.string(),
});
