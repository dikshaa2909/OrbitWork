"use client";

import React, { useState } from "react";
import { Lock } from "lucide-react";
import { usePermissions, PermissionContext } from "@/hooks/use-permissions";
import { RequestAccessDialog } from "@/features/access-requests/components/request-access-dialog";
import { Button } from "@/components/ui/button";

interface GuardedActionProps {
  permission: string;
  resourceType?: string;
  resourceId?: string;
  context?: PermissionContext;
  workspaceId?: string;
  projectId?: string;
  /** If true, renders a clean "Request access" button directly when denied */
  renderRequestButton?: boolean;
  /** Label for the fallback request button */
  requestButtonLabel?: string;
  children: React.ReactNode;
}

export const GuardedAction: React.FC<GuardedActionProps> = ({
  permission,
  resourceType,
  resourceId,
  context,
  workspaceId,
  projectId,
  renderRequestButton = false,
  requestButtonLabel = "Request access",
  children,
}) => {
  const { can, isLoading } = usePermissions(workspaceId, projectId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const hasAccess = can(permission, context);

  if (isLoading) {
    return <>{children}</>;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  // Denied state: Do NOT silently hide. Offer explicit request access action!
  return (
    <>
      <RequestAccessDialog
        isOpen={dialogOpen}
        setIsOpen={setDialogOpen}
        initialPermission={permission}
        resourceType={resourceType}
        resourceId={resourceId}
      />
      {renderRequestButton ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="text-xs gap-1.5 text-muted-foreground hover:text-foreground border-dashed"
        >
          <Lock className="size-3.5 text-amber-500" />
          {requestButtonLabel}
        </Button>
      ) : (
        <div
          className="relative inline-flex items-center group cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDialogOpen(true);
          }}
          title="Click to request permission from workspace admins"
        >
          <div className="opacity-50 pointer-events-none select-none">
            {children}
          </div>
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white shadow-sm ring-1 ring-white">
            <Lock className="size-2.5" />
          </span>
        </div>
      )}
    </>
  );
};
