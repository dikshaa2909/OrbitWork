"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { RequestAccessDialog } from "@/features/access-requests/components/request-access-dialog";
import { PERMISSIONS_CATALOG } from "@/lib/permissions/catalog";

interface NoAccessPageProps {
  requiredPermission?: string;
  workspaceId: string;
  title?: string;
  description?: string;
}

export const NoAccessPage: React.FC<NoAccessPageProps> = ({
  requiredPermission = "workspace:settings.edit",
  workspaceId,
  title = "Access Restricted",
  description,
}) => {
  const { role } = usePermissions(workspaceId);
  const [requestOpen, setRequestOpen] = useState(false);

  const perm = PERMISSIONS_CATALOG.find((p) => p.key === requiredPermission);
  const permDesc = perm?.description || `Requires '${requiredPermission}' permission.`;

  return (
    <>
      <RequestAccessDialog
        isOpen={requestOpen}
        setIsOpen={setRequestOpen}
        initialPermission={requiredPermission}
      />
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center max-w-lg mx-auto">
        <div className="size-16 rounded-2xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mb-5 text-amber-600 shadow-sm border border-amber-200/50">
          <ShieldAlert className="size-8" />
        </div>

        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          {title}
        </h2>

        <p className="text-sm text-muted-foreground mt-2">
          {description || permDesc}
        </p>

        <div className="mt-4 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-300">
          Current role: <span className="font-bold uppercase text-foreground">{role || "Viewer"}</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            onClick={() => setRequestOpen(true)}
            className="gap-2 text-xs"
          >
            <Key className="size-3.5" />
            Request Permission
          </Button>

          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link href={`/workspaces/${workspaceId}`}>
              <ArrowLeft className="size-3.5 mr-1.5" />
              Back to Workspace
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
};
