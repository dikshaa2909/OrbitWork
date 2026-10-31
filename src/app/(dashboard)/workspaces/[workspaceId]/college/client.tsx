"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCollegePersona } from "@/features/college/hooks/use-college-persona";
import { BatchesView } from "@/features/college/components/batches-view";

export const CollegeClient = () => {
  const workspaceId = useWorkspaceId();
  const router = useRouter();
  const { isStudent, isTeamLead, isHod, isGuide, isLoading } = useCollegePersona(workspaceId);

  const isAnyStudent = (isStudent || isTeamLead) && !isHod && !isGuide;

  useEffect(() => {
    if (!isLoading && isAnyStudent) {
      toast.error("Students manage project deliverables directly from their Group Workspace.");
      router.replace(`/workspaces/${workspaceId}`);
    }
  }, [isLoading, isAnyStudent, router, workspaceId]);

  if (isLoading || isAnyStudent) {
    return (
      <div className="flex items-center justify-center min-h-[360px]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in">
      <BatchesView workspaceId={workspaceId} />
    </div>
  );
};
