import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { Role } from "../types";

interface UseGetRolesProps {
  workspaceId?: string;
}

export const useGetRoles = ({ workspaceId }: UseGetRolesProps = {}) => {
  const query = useQuery({
    enabled: !!workspaceId,
    queryKey: ["roles", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      const response = await client.api.roles.$get({
        query: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch roles");
      }

      const { data } = await response.json();
      return data as Role[];
    },
  });

  return query;
};
