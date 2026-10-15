import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { Member } from "../types";

interface UseCurrentMemberProps {
  workspaceId?: string;
}

export const useCurrentMember = ({ workspaceId }: UseCurrentMemberProps = {}) => {
  const query = useQuery({
    enabled: !!workspaceId,
    queryKey: ["current-member", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;

      const response = await client.api.members.current.$get({
        query: { workspaceId },
      });

      if (!response.ok) {
        return null;
      }

      const { data } = await response.json();
      return data as Member;
    },
  });

  return query;
};
