"use client";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { BatchesView } from "@/features/college/components/batches-view";

export const CollegeClient = () => {
  const workspaceId = useWorkspaceId();

  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in">
      <BatchesView workspaceId={workspaceId} />
    </div>
  );
};

