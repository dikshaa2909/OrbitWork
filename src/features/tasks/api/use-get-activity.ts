import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetActivityProps {
  taskId: string;
}

export const useGetActivity = ({ taskId }: UseGetActivityProps) => {
  const query = useQuery({
    queryKey: ["activity", taskId],
    queryFn: async () => {
      const response = await client.api.tasks[":taskId"]["activity"].$get({
        param: { taskId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch activity log");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!taskId,
  });

  return query;
};
