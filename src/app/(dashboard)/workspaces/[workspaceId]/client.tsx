"use client";

import React from "react";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetMembers } from "@/features/members/api/use-get-members";

import { WorkspaceFallbackScreen } from "@/components/workspace-fallback-screen";
import { AwaitingPermissionsBanner } from "@/components/awaiting-permissions-banner";
import { WorkspaceDashboard } from "@/features/workspaces/components/workspace-dashboard";

// Re-export dashboard widgets for other consumers
export * from "@/features/workspaces/components/dashboard-widgets";

export const WorkspaceIdClient = () => {
  const workspaceId = useWorkspaceId();
  const { data: members, isLoading: isLoadingMembers } = useGetMembers({ workspaceId });

  // Only show fallback screen when initial member check finishes and user has no access
  if (!isLoadingMembers && !members) {
    return (
      <WorkspaceFallbackScreen
        title="Workspace Not Accessible"
        message="You are no longer a member of this workspace, or it has been deleted."
      />
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4 animate-fade-in">
      <AwaitingPermissionsBanner workspaceId={workspaceId} />
      <WorkspaceDashboard workspaceId={workspaceId} />
    </div>
  );
};
