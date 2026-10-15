import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetNotificationsProps {
  workspaceId?: string;
  read?: "true" | "false";
}

export const useGetNotifications = ({ workspaceId, read }: UseGetNotificationsProps) => {
  const query = useQuery({
    queryKey: ["notifications", workspaceId, read || "all"],
    queryFn: async () => {
      if (!workspaceId) return { documents: [], total: 0 };

      const response = await client.api.notifications.$get({
        query: { workspaceId, read },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!workspaceId,
    refetchInterval: 10000, // Refresh every 10s for new notifications
  });

  return query;
};
