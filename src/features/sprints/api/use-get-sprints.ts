import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

interface UseGetSprintsProps {
  workspaceId: string;
  projectId?: string | null;
}

export const useGetSprints = ({
  workspaceId,
  projectId,
}: UseGetSprintsProps) => {
  const query = useQuery({
    queryKey: ["sprints", workspaceId, projectId],
    queryFn: async () => {
      const response = await client.api.sprints.$get({
        query: {
          workspaceId,
          projectId: projectId ?? undefined,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch sprints");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!workspaceId,
  });

  return query;
};
