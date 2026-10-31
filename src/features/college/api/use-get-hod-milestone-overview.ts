import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { HodMilestoneOverviewResponse } from "../types";

interface UseGetHodMilestoneOverviewProps {
  batchId?: string | null;
}

export const useGetHodMilestoneOverview = ({
  batchId,
}: UseGetHodMilestoneOverviewProps) => {
  const query = useQuery({
    queryKey: ["hod-milestone-overview", batchId],
    queryFn: async (): Promise<HodMilestoneOverviewResponse | null> => {
      if (!batchId) return null;

      const response = await client.api.college["batches"][":batchId"]["hod-milestone-overview"].$get({
        param: { batchId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch department milestone overview");
      }

      const { data } = await response.json();
      return data as unknown as HodMilestoneOverviewResponse;
    },
    enabled: Boolean(batchId),
  });

  return query;
};

