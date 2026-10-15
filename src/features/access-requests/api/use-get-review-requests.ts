import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetReviewRequestsProps {
  workspaceId: string;
  status?: "PENDING" | "APPROVED" | "DENIED" | "CANCELLED" | "EXPIRED";
}

export const useGetReviewRequests = ({ workspaceId, status }: UseGetReviewRequestsProps) => {
  const query = useQuery({
    queryKey: ["access-requests", "review", workspaceId, status || "all"],
    queryFn: async () => {
      const response = await client.api["access-requests"]["review"].$get({
        query: { workspaceId, status },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch access requests for review");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!workspaceId,
  });

  return query;
};
