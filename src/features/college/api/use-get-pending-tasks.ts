import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { GuideTaskVerificationItem } from "../types";

interface UseGetPendingTasksProps {
  workspaceId?: string;
  batchId?: string;
}

export const useGetPendingTasks = ({ workspaceId, batchId }: UseGetPendingTasksProps = {}) => {
  const query = useQuery({
    enabled: !!workspaceId,
    queryKey: ["college-guide-pending-tasks", workspaceId, batchId],
    queryFn: async () => {
      if (!workspaceId) return [];

      const response = await client.api.college.guide["pending-tasks"].$get({
        query: { workspaceId, batchId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch pending verification tasks");
      }

      const { data } = await response.json();
      return data as GuideTaskVerificationItem[];
    },
  });

  return query;
};

