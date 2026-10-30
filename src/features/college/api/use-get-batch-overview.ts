import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { BatchGroupProgress } from "../types";

interface UseGetBatchOverviewProps {
  batchId?: string;
}

export const useGetBatchOverview = ({ batchId }: UseGetBatchOverviewProps = {}) => {
  const query = useQuery({
    enabled: !!batchId,
    queryKey: ["college-batch-overview", batchId],
    queryFn: async () => {
      if (!batchId) return [];

      const response = await client.api.college.batches[":batchId"].overview.$get({
        param: { batchId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch batch overview");
      }

      const { data } = await response.json();
      return data as BatchGroupProgress[];
    },
  });

  return query;
};

