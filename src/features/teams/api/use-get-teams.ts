import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { Team } from "../types";

interface UseGetTeamsProps {
  workspaceId?: string;
}

export const useGetTeams = ({ workspaceId }: UseGetTeamsProps = {}) => {
  const query = useQuery({
    enabled: !!workspaceId,
    queryKey: ["teams", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      const response = await client.api.teams.$get({
        query: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch teams");
      }

      const { data } = await response.json();
      return data as Team[];
    },
  });

  return query;
};
