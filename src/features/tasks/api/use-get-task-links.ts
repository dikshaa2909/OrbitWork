import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetTaskLinksProps {
  taskId: string;
}

export const useGetTaskLinks = ({ taskId }: UseGetTaskLinksProps) => {
  const query = useQuery({
    queryKey: ["task-links", taskId],
    queryFn: async () => {
      const response = await client.api.tasks[":taskId"]["links"].$get({
        param: { taskId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch task links");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!taskId,
  });

  return query;
};
