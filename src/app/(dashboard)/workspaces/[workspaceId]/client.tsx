"use client";

import React from "react";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useGetWorkspaceAnalytics } from "@/features/workspaces/api/use-get-workspace-analytics";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetGuideGroups } from "@/features/college/api/use-get-guide-groups";
import { usePermissions } from "@/hooks/use-permissions";
import { MemberRole } from "@/features/members/types";

import { WorkspaceFallbackScreen } from "@/components/workspace-fallback-screen";
import { AwaitingPermissionsBanner } from "@/components/awaiting-permissions-banner";

import { StartupDashboardView } from "@/features/workspaces/components/dashboard/startup-dashboard-view";
import { CollegeHodDashboardView } from "@/features/workspaces/components/dashboard/college-hod-dashboard-view";
import { CollegeGuideDashboardView } from "@/features/workspaces/components/dashboard/college-guide-dashboard-view";
import { CollegeStudentDashboardView } from "@/features/workspaces/components/dashboard/college-student-dashboard-view";

// Re-export dashboard widgets for other consumers
export * from "@/features/workspaces/components/dashboard-widgets";

export const WorkspaceIdClient = () => {
  const workspaceId = useWorkspaceId();

  const { data: workspace } = useGetWorkspace({ workspaceId });
  const { data: analytics, isLoading: isLoadingAnalytics } = useGetWorkspaceAnalytics({ workspaceId });
  const { data: tasks, isLoading: isLoadingTasks } = useGetTasks({ workspaceId });
  const { data: projects, isLoading: isLoadingProjects } = useGetProjects({ workspaceId });
  const { data: members, isLoading: isLoadingMembers } = useGetMembers({ workspaceId });
  const { data: guideGroups = [] } = useGetGuideGroups({ workspaceId });

  const { role, can } = usePermissions(workspaceId);

  // Only show fallback screen when initial member check finishes and user has no access
  if (!isLoadingMembers && !members) {
    return (
      <WorkspaceFallbackScreen
        title="Workspace Not Accessible"
        message="You are no longer a member of this workspace, or it has been deleted."
      />
    );
  }

  const isCollege = workspace?.type === "COLLEGE";
  const isHod = role === MemberRole.ADMIN || can("college:batches.manage");
  const isGuide = guideGroups.length > 0 || can("college:tasks.verify");

  return (
    <div className="h-full flex flex-col space-y-4 animate-fade-in">
      <AwaitingPermissionsBanner workspaceId={workspaceId} />

      {isCollege && workspace ? (
        isHod ? (
          <CollegeHodDashboardView workspace={workspace} />
        ) : isGuide ? (
          <CollegeGuideDashboardView workspace={workspace} />
        ) : (
          <CollegeStudentDashboardView workspace={workspace} />
        )
      ) : (
        <StartupDashboardView
          analytics={analytics}
          isLoadingAnalytics={isLoadingAnalytics}
          tasks={tasks}
          isLoadingTasks={isLoadingTasks}
          projects={projects}
          isLoadingProjects={isLoadingProjects}
          members={members}
          isLoadingMembers={isLoadingMembers}
        />
      )}
    </div>
  );
};
