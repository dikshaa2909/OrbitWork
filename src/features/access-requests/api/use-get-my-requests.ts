import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetMyRequestsProps {
  workspaceId: string;
}

export const useGetMyRequests = ({ workspaceId }: UseGetMyRequestsProps) => {
  const query = useQuery({
    queryKey: ["access-requests", "mine", workspaceId],
    queryFn: async () => {
      const response = await client.api["access-requests"]["mine"].$get({
        query: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch your access requests");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!workspaceId,
  });

  return query;
};
