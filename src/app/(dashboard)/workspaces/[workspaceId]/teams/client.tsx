"use client";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { TeamsView } from "@/features/teams/components/teams-view";

export const TeamsClient = () => {
  const workspaceId = useWorkspaceId();

  return (
    <div className="w-full max-w-6xl mx-auto">
      <TeamsView workspaceId={workspaceId} />
    </div>
  );
};
