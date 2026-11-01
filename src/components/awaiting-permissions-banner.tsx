"use client";

import React, { useState } from "react";
import { Info, Key, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useCollegePersona } from "@/features/college/hooks/use-college-persona";
import { RequestAccessDialog } from "@/features/access-requests/components/request-access-dialog";

interface AwaitingPermissionsBannerProps {
  workspaceId: string;
}

export const AwaitingPermissionsBanner: React.FC<AwaitingPermissionsBannerProps> = ({
  workspaceId,
}) => {
  const { data: workspace, isLoading: isWorkspaceLoading } = useGetWorkspace({ workspaceId });
  const { isHod, isGuide, isStudent, isTeamLead, isLoading: isPersonaLoading } = useCollegePersona(workspaceId);
  const { isOwner, isAdmin, isPM, canCreateTask, canCreateProject, isLoading, role } =
    usePermissions(workspaceId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Barrier: While any context queries are settling, do not render banner to prevent flash
  if (isWorkspaceLoading || isPersonaLoading || isLoading || dismissed) {
    return null;
  }

  // In College workspaces, structured academic roles govern actions - do NOT show corporate view-only banner
  if (
    workspace?.type === "COLLEGE" ||
    (workspace as unknown as { archetype?: string })?.archetype === "COLLEGE" ||
    isHod ||
    isGuide ||
    isStudent ||
    isTeamLead
  ) {
    return null;
  }

  // If user already has significant powers (owner, admin, PM, can create tasks)
  if (isOwner || isAdmin || isPM || (canCreateTask && canCreateProject)) return null;

  return (
    <>
      <RequestAccessDialog
        isOpen={dialogOpen}
        setIsOpen={setDialogOpen}
        initialPermission="tasks:create"
      />
      <div className="mx-4 mb-4 mt-2 flex items-center justify-between rounded-xl border border-blue-200/80 bg-blue-50/80 p-3 text-xs text-blue-900 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
        <div className="flex items-center gap-2.5">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/80 dark:text-blue-300">
            <Info className="size-3.5" />
          </div>
          <div>
            <span className="font-semibold">View-only mode:</span> You have joined as{" "}
            <span className="font-bold uppercase tracking-wide">
              {role || "Viewer"}
            </span>
            . To create tasks, edit projects, or participate actively, ask an administrator for access.
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => setDialogOpen(true)}
            className="h-7 gap-1.5 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Key className="size-3" />
            Request Access
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 p-1"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </>
  );
};
