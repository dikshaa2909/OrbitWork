import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetGuideDashboardProps {
  workspaceId: string;
}

export const useGetGuideDashboard = ({ workspaceId }: UseGetGuideDashboardProps) => {
  const query = useQuery({
    queryKey: ["college-guide-dashboard", workspaceId],
    queryFn: async () => {
      const response = await client.api.college["guide"]["dashboard"].$get({
        query: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch guide dashboard");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!workspaceId,
  });

  return query;
};

