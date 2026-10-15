import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { PermissionAuditLog } from "../types";

interface UseGetAuditLogsProps {
  workspaceId?: string;
  limit?: number;
}

export const useGetAuditLogs = ({ workspaceId, limit = 50 }: UseGetAuditLogsProps = {}) => {
  const query = useQuery({
    enabled: !!workspaceId,
    queryKey: ["role-audit-logs", workspaceId, limit],
    queryFn: async () => {
      if (!workspaceId) return [];

      const response = await client.api.roles.audit.$get({
        query: { workspaceId, limit: limit.toString() },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch audit logs");
      }

      const { data } = await response.json();
      return data as PermissionAuditLog[];
    },
  });

  return query;
};
