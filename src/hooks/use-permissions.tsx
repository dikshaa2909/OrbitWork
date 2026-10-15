"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { MemberRole } from "@/features/members/types";
import { Button } from "@/components/ui/button";
import { PERMISSIONS_CATALOG } from "@/lib/permissions/catalog";
import { useGetEffectivePermissions } from "@/features/roles/api/use-get-effective-permissions";
import { usePreviewRole } from "./use-preview-role";
import { RequestAccessDialog } from "@/features/access-requests/components/request-access-dialog";

export interface PermissionContext {
  memberId?: string;
  reporterId?: string | null;
  assigneeId?: string | null;
  /** Whether the current user owns the resource (for .own permission checks) */
  isOwn?: boolean;
}

export function getPermissionDeniedReason(actionOrKey: string): string {
  const cat = PERMISSIONS_CATALOG.find((p) => p.key === actionOrKey);
  if (cat) return `Requires '${cat.name}' permission: ${cat.description}`;
  return "You do not have permission to perform this action";
}

export interface UsePermissionsResult {
  role: MemberRole | undefined;
  memberId: string | undefined;
  isLoading: boolean;
  can: (action: string, context?: PermissionContext) => boolean;
  getDeniedReason: (action: string) => string;
  canDeleteWorkspace: boolean;
  canEditWorkspace: boolean;
  canManageMembers: boolean;
  canCreateProject: boolean;
  canEditProject: boolean;
  canDeleteProject: boolean;
  canManageSprints: boolean;
  canCreateTask: boolean;
  canComment: boolean;
  canLogWork: boolean;
  canDragTask: boolean;
  canViewAll: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isPM: boolean;
  isMember: boolean;
  isViewer: boolean;
  isGuest: boolean;
  isPreview: boolean;
  previewRoleId: string | null;
  previewRoleName: string | null;
  setPreviewRole: (roleId: string | null, roleName?: string | null) => void;
  clearPreviewRole: () => void;
}

export function usePermissions(
  workspaceIdOverride?: string,
  projectIdOverride?: string
): UsePermissionsResult {
  const routeWorkspaceId = useWorkspaceId();
  const workspaceId = workspaceIdOverride || routeWorkspaceId;

  const { previewRoleId, previewRoleName, setPreviewRole, clearPreviewRole } = usePreviewRole();

  const { data: member, isLoading: isMemberLoading } = useCurrentMember({ workspaceId });
  const { data: effectiveData, isLoading: isPermsLoading } = useGetEffectivePermissions({
    workspaceId,
    projectId: projectIdOverride,
    previewRoleId: previewRoleId || undefined,
  });

  const memberId = member?.$id || member?.id;

  // Role details
  const roleLevel = effectiveData?.role?.level;
  const isSystemRole = effectiveData?.role?.isSystem;
  
  const role: MemberRole | undefined = useMemo(() => {
    if (isSystemRole && roleLevel === 0) return MemberRole.OWNER;
    if (roleLevel === 10) return MemberRole.ADMIN;
    if (roleLevel === 30) return MemberRole.PROJECT_MANAGER;
    if (roleLevel === 80) return MemberRole.VIEWER;
    if (roleLevel === 90) return MemberRole.GUEST;
    if (member?.role) return member.role as MemberRole;
    return MemberRole.MEMBER;
  }, [roleLevel, isSystemRole, member?.role]);

  const can = useMemo(() => {
    return (actionOrKey: string, context?: PermissionContext): boolean => {
      // 1. If effective permissions are loaded from DB
      if (effectiveData?.permissions) {
        // Owner level 0 (system role) has bypass across everything
        if (effectiveData.role.isSystem && effectiveData.role.level === 0) return true;

        const catalogKey = actionOrKey;

        // Check ownership context for tasks or comments
        if (catalogKey === "tasks:edit" || catalogKey === "tasks:edit.any" || actionOrKey === "edit_task") {
          if (effectiveData.permissions["tasks:edit.any"]) return true;
          if (effectiveData.permissions["tasks:edit.own"]) {
            if (context?.isOwn || (context?.memberId && memberId && context.memberId === memberId)) {
              return true;
            }
          }
          return false;
        }

        if (catalogKey === "tasks:delete" || catalogKey === "tasks:delete.any" || actionOrKey === "delete_task") {
          if (effectiveData.permissions["tasks:delete.any"]) return true;
          if (effectiveData.permissions["tasks:delete.own"]) {
            if (context?.isOwn || (context?.memberId && memberId && context.memberId === memberId)) {
              return true;
            }
          }
          return false;
        }

        if (catalogKey === "comments:delete" || actionOrKey === "delete_comment") {
          if (effectiveData.permissions["comments:delete.any"]) return true;
          if (effectiveData.permissions["comments:delete.own"]) {
            if (context?.isOwn || (context?.memberId && memberId && context.memberId === memberId)) {
              return true;
            }
          }
          return false;
        }

        if (catalogKey === "tasks:view.all" || actionOrKey === "view_everything") {
          if (effectiveData.permissions["tasks:view.all"]) return true;
          return false;
        }

        return Boolean(effectiveData.permissions[catalogKey]);
      }

      // Deny by default until effective permissions are loaded
      return false;
    };
  }, [effectiveData, memberId]);

  return {
    role,
    memberId,
    isLoading: isMemberLoading || (!!workspaceId && isPermsLoading && !effectiveData),
    can,
    getDeniedReason: (action: string) => getPermissionDeniedReason(action),
    canDeleteWorkspace: can("workspace:delete"),
    canEditWorkspace: can("workspace:settings.edit"),
    canManageMembers: can("members:roles.assign") || can("members:invite"),
    canCreateProject: can("projects:create"),
    canEditProject: can("projects:edit"),
    canDeleteProject: can("projects:delete"),
    canManageSprints: can("sprints:manage"),
    canCreateTask: can("tasks:create"),
    canComment: can("comments:create"),
    canLogWork: can("time:log"),
    canDragTask: can("tasks:transition"),
    canViewAll: can("tasks:view.all"),
    isOwner: role === MemberRole.OWNER,
    isAdmin: role === MemberRole.ADMIN,
    isPM: role === MemberRole.PROJECT_MANAGER,
    isMember: role === MemberRole.MEMBER,
    isViewer: role === MemberRole.VIEWER,
    isGuest: role === MemberRole.GUEST,
    isPreview: Boolean(effectiveData?.isPreview || previewRoleId),
    previewRoleId,
    previewRoleName,
    setPreviewRole,
    clearPreviewRole,
  };
}

interface CanProps {
  action: string;
  workspaceId?: string;
  projectId?: string;
  context?: PermissionContext;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({
  action,
  workspaceId,
  projectId,
  context,
  fallback = null,
  children,
}) => {
  const { can, isLoading } = usePermissions(workspaceId, projectId);

  if (isLoading) {
    return null;
  }

  if (!can(action, context)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

interface PermissionGuardProps {
  action: string;
  workspaceId?: string;
  projectId?: string;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  action,
  workspaceId: workspaceIdProp,
  projectId,
  children,
}) => {
  const routeWorkspaceId = useWorkspaceId();
  const workspaceId = workspaceIdProp || routeWorkspaceId;
  const { can, isLoading, role } = usePermissions(workspaceId, projectId);
  const [requestOpen, setRequestOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!can(action)) {
    return (
      <>
        <RequestAccessDialog
          isOpen={requestOpen}
          setIsOpen={setRequestOpen}
          initialPermission={action}
        />
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <div className="size-16 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mb-4 text-amber-600">
            <ShieldAlert className="size-8" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            You don&apos;t have access
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            {getPermissionDeniedReason(action)}. Your current role in this workspace is{" "}
            <span className="font-semibold uppercase text-neutral-800 dark:text-neutral-200">
              {role || "Unknown"}
            </span>
            .
          </p>
          <div className="mt-6 flex items-center gap-x-3">
            <Button
              type="button"
              onClick={() => setRequestOpen(true)}
              className="text-xs"
            >
              Request Access
            </Button>
            <Button asChild variant="secondary" className="text-xs">
              <Link href={`/workspaces/${workspaceId}`}>
                <ArrowLeft className="size-4 mr-2" />
                Back to Workspace
              </Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  return <>{children}</>;
};
