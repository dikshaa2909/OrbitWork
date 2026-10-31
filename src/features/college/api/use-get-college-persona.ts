import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

export interface AcademicTeamSummary {
  id: string;
  teamCode: string;
  title: string;
  abstract?: string | null;
  projectId?: string | null;
  leadMemberId?: string | null;
  guideName?: string;
  guideUserId?: string | null;
}

export interface CollegePersonaResponse {
  persona: "HOD" | "FACULTY_GUIDE" | "TEAM_LEAD" | "STUDENT";
  badgeLabel: "HOD / Coordinator" | "Faculty Guide" | "Team Lead" | "Student";
  isHod: boolean;
  isGuide: boolean;
  isTeamLead: boolean;
  isStudent: boolean;
  teamId: string | null;
  team: AcademicTeamSummary | null;
  guidedTeamsCount: number;
}

interface UseGetCollegePersonaProps {
  workspaceId?: string;
}

export const useGetCollegePersona = ({ workspaceId }: UseGetCollegePersonaProps = {}) => {
  const query = useQuery({
    enabled: !!workspaceId,
    queryKey: ["college-persona", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;

      const response = await client.api.college.workspaces[":workspaceId"].persona.$get({
        param: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch college persona");
      }

      const { data } = await response.json();
      return data as CollegePersonaResponse;
    },
    staleTime: 30_000,
  });

  return query;
};

