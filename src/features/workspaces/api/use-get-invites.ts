import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetInvitesProps {
  workspaceId: string;
}

export const useGetInvites = ({ workspaceId }: UseGetInvitesProps) => {
  const query = useQuery({
    enabled: !!workspaceId,
    queryKey: ["invites", workspaceId],
    queryFn: async () => {
      const response = await client.api.workspaces[":workspaceId"]["invites"].$get({
        param: { workspaceId },
      });

      if (!response.ok) {
        return [];
      }

      const { data } = await response.json();
      return data;
    },
  });

  return query;
};
