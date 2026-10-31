import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetCollegePersona } from "../api/use-get-college-persona";

export interface CollegePersonaHookResult {
  isHod: boolean;
  isGuide: boolean;
  isTeamLead: boolean;
  isStudent: boolean;
  persona: "HOD" | "FACULTY_GUIDE" | "TEAM_LEAD" | "STUDENT" | null;
  badgeLabel: "HOD / Coordinator" | "Faculty Guide" | "Team Lead" | "Student" | null;
  teamId: string | null;
  team: {
    id: string;
    teamCode: string;
    title: string;
    abstract?: string | null;
    projectId?: string | null;
    leadMemberId?: string | null;
    guideName?: string;
    guideUserId?: string | null;
  } | null;
  guidedTeamsCount: number;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * True Role & Persona Resolution Hook for College Workspaces.
 * Single source of truth that guarantees strict role boundaries and eliminates Jira corporate labels.
 */
export const useCollegePersona = (workspaceIdParam?: string): CollegePersonaHookResult => {
  const currentWorkspaceId = useWorkspaceId();
  const workspaceId = workspaceIdParam || currentWorkspaceId;

  const { data, isLoading, refetch } = useGetCollegePersona({ workspaceId });

  return {
    isHod: Boolean(data?.isHod),
    isGuide: Boolean(data?.isGuide),
    isTeamLead: Boolean(data?.isTeamLead),
    isStudent: Boolean(data?.isStudent),
    persona: data?.persona ?? null,
    badgeLabel: data?.badgeLabel ?? null,
    teamId: data?.teamId ?? null,
    team: data?.team ?? null,
    guidedTeamsCount: data?.guidedTeamsCount ?? 0,
    isLoading,
    refetch,
  };
};

