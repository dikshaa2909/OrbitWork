import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { TeamMilestoneItem, AcademicTeam, Batch } from "../types";

interface UseGetTeamMilestonesProps {
  teamId?: string | null;
}

interface TeamMilestonesData {
  team: AcademicTeam;
  batch: Batch;
  milestones: TeamMilestoneItem[];
}

export const useGetTeamMilestones = ({
  teamId,
}: UseGetTeamMilestonesProps) => {
  const query = useQuery({
    queryKey: ["team-milestones", teamId],
    queryFn: async (): Promise<TeamMilestonesData | null> => {
      if (!teamId) return null;

      const response = await client.api.college["teams"][":teamId"]["milestones"].$get({
        param: { teamId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch group milestones");
      }

      const { data } = await response.json();
      return data as unknown as TeamMilestonesData;
    },
    enabled: Boolean(teamId),
  });

  return query;
};

