"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { RolesView } from "@/features/roles/components/roles-view";
import { PermissionGuard } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";

export const RolesSettingsClient = () => {
  const workspaceId = useWorkspaceId();

  return (
    <PermissionGuard action="roles:manage" workspaceId={workspaceId}>
      <div className="w-full max-w-6xl animate-fade-in space-y-4">
        {/* Breadcrumb & Back Navigation */}
        <div className="flex items-center justify-between pb-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground -ml-2"
          >
            <Link href={`/workspaces/${workspaceId}/settings`}>
              <ArrowLeft className="size-4" />
              Back to Settings
            </Link>
          </Button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Link href={`/workspaces/${workspaceId}`} className="hover:underline">
              Workspace
            </Link>
            <span>&gt;</span>
            <Link href={`/workspaces/${workspaceId}/settings`} className="hover:underline">
              Settings
            </Link>
            <span>&gt;</span>
            <span className="text-foreground font-semibold">Roles</span>
          </div>
        </div>

        <RolesView workspaceId={workspaceId} />
      </div>
    </PermissionGuard>
  );
};
