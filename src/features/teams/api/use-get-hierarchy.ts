import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetHierarchyProps {
  workspaceId?: string;
}

export interface HierarchyMember {
  id: string;
  $id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  roleId: string | null;
  reportsToId: string | null;
}

export const useGetHierarchy = ({ workspaceId }: UseGetHierarchyProps = {}) => {
  const query = useQuery({
    enabled: !!workspaceId,
    queryKey: ["hierarchy", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;

      const response = await client.api.teams.hierarchy.$get({
        query: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch hierarchy");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return query;
};
