"use client";

import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { EditWorkspaceForm } from "@/features/workspaces/components/edit-workspace-form";

import { PageLoader } from "@/components/page-loader";
import { PageError } from "@/components/page-error";
import { PermissionGuard } from "@/hooks/use-permissions";

import Link from "next/link";
import { ShieldCheck, Network, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const WorkspaceIdSettingsClient = () => {
  const workspaceId = useWorkspaceId();
  const { data: initialValues, isLoading } = useGetWorkspace({ workspaceId });

  if (isLoading) {
    return <PageLoader />
  }

  if (!initialValues) {
    return <PageError message="Workspace not found" />
  }

  return (
    <PermissionGuard action="edit_workspace" workspaceId={workspaceId}>
      <div className="w-full lg:max-w-xl space-y-4">
        <Card className="border border-neutral-200 shadow-none">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Roles & Permissions</h4>
                <p className="text-xs text-muted-foreground">Manage permission matrix, templates & custom roles</p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="w-full sm:w-auto text-xs gap-1">
              <Link href={`/workspaces/${workspaceId}/settings/roles`}>
                Configure
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-neutral-200 shadow-none">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Network className="size-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Teams & Organization Chart</h4>
                <p className="text-xs text-muted-foreground">Organize squads, department leads & reporting hierarchy</p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="w-full sm:w-auto text-xs gap-1">
              <Link href={`/workspaces/${workspaceId}/teams`}>
                View
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <EditWorkspaceForm initialValues={initialValues} />
      </div>
    </PermissionGuard>
  );
};
