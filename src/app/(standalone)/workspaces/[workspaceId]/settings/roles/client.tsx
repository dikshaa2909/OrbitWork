"use client";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { RolesView } from "@/features/roles/components/roles-view";
import { PermissionGuard } from "@/hooks/use-permissions";

export const RolesSettingsClient = () => {
  const workspaceId = useWorkspaceId();

  return (
    <PermissionGuard action="roles:manage" workspaceId={workspaceId}>
      <div className="w-full max-w-6xl">
        <RolesView workspaceId={workspaceId} />
      </div>
    </PermissionGuard>
  );
};
