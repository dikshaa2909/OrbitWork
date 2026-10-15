import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetLabelsProps {
  workspaceId: string;
}

export const useGetLabels = ({ workspaceId }: UseGetLabelsProps) => {
  const query = useQuery({
    queryKey: ["labels", workspaceId],
    queryFn: async () => {
      const response = await client.api.tasks["workspace-labels"].$get({
        query: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch labels");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!workspaceId,
  });

  return query;
};
