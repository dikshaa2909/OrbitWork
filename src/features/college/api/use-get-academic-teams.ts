import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { AcademicTeam } from "../types";

interface UseGetTeamsProps {
  batchId?: string | null;
}

export const useGetAcademicTeams = ({ batchId }: UseGetTeamsProps = {}) => {
  const query = useQuery({
    enabled: !!batchId,
    queryKey: ["college-teams", batchId],
    queryFn: async () => {
      if (!batchId) return [];

      const response = await client.api.college.batches[":batchId"].teams.$get({
        param: { batchId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch academic teams");
      }

      const { data } = await response.json();
      return data as AcademicTeam[];
    },
  });

  return query;
};

