import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { GuideSubmissionItem } from "../types";

interface UseGetGuideSubmissionsProps {
  workspaceId?: string;
  batchId?: string | null;
}

export const useGetGuideSubmissions = ({
  workspaceId,
  batchId,
}: UseGetGuideSubmissionsProps) => {
  const query = useQuery({
    queryKey: ["guide-submissions", workspaceId || null, batchId || null],
    queryFn: async (): Promise<GuideSubmissionItem[]> => {
      if (workspaceId) {
        const response = await client.api.college.workspaces[":workspaceId"]["guide-submissions"].$get({
          param: { workspaceId },
          query: { batchId: batchId || undefined },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch guide group submissions");
        }

        const { data } = await response.json();
        return (data || []) as unknown as GuideSubmissionItem[];
      }

      if (batchId) {
        const response = await client.api.college["batches"][":batchId"]["guide-submissions"].$get({
          param: { batchId },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch guide group submissions");
        }

        const { data } = await response.json();
        return (data || []) as unknown as GuideSubmissionItem[];
      }

      return [];
    },
    enabled: Boolean(workspaceId || batchId),
  });

  return query;
};

