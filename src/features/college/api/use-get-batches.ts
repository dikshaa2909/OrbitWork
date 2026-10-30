import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { Batch } from "../types";

interface UseGetBatchesProps {
  workspaceId?: string;
}

export const useGetBatches = ({ workspaceId }: UseGetBatchesProps = {}) => {
  const query = useQuery({
    enabled: !!workspaceId,
    queryKey: ["college-batches", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      const response = await client.api.college.workspaces[":workspaceId"].batches.$get({
        param: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch batches");
      }

      const { data } = await response.json();
      return data as Batch[];
    },
  });

  return query;
};

