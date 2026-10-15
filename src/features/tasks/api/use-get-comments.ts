import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetCommentsProps {
  taskId: string;
}

export const useGetComments = ({ taskId }: UseGetCommentsProps) => {
  const query = useQuery({
    queryKey: ["comments", taskId],
    queryFn: async () => {
      const response = await client.api.tasks[":taskId"]["comments"].$get({
        param: { taskId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!taskId,
  });

  return query;
};
