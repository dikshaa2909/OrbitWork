import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetEffectivePermissionsProps {
  workspaceId?: string;
  projectId?: string;
  previewRoleId?: string;
}

export interface EffectivePermissionsData {
  permissions: Record<string, boolean>;
  role: {
    id?: string;
    name: string;
    level: number;
    color?: string;
    isSystem: boolean;
  };
  isPreview: boolean;
}

export const useGetEffectivePermissions = ({
  workspaceId,
  projectId,
  previewRoleId,
}: UseGetEffectivePermissionsProps = {}) => {
  const query = useQuery({
    enabled: !!workspaceId,
    queryKey: ["effective-permissions", workspaceId, projectId, previewRoleId],
    queryFn: async () => {
      if (!workspaceId) return null;

      const response = await client.api.roles.effective.$get({
        query: {
          workspaceId,
          projectId: projectId || undefined,
          previewRoleId: previewRoleId || undefined,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch effective permissions");
      }

      const { data } = await response.json();
      return data as EffectivePermissionsData;
    },
  });

  return query;
};
