import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { Milestone } from "../types";

interface UseGetMilestonesProps {
  batchId?: string | null;
}

export const useGetMilestones = ({ batchId }: UseGetMilestonesProps = {}) => {
  const query = useQuery({
    enabled: !!batchId,
    queryKey: ["college-milestones", batchId],
    queryFn: async () => {
      if (!batchId) return [];

      const response = await client.api.college.batches[":batchId"].milestones.$get({
        param: { batchId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch milestones");
      }

      const { data } = await response.json();
      return data as Milestone[];
    },
  });

  return query;
};

