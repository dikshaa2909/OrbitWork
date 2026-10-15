import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetInviteLinksProps {
  workspaceId: string;
}

export const useGetInviteLinks = ({ workspaceId }: UseGetInviteLinksProps) => {
  const query = useQuery({
    queryKey: ["invite-links", workspaceId],
    queryFn: async () => {
      const response = await client.api["invite-links"].$get({
        query: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch invite links");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!workspaceId,
  });

  return query;
};
