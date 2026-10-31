"use client";

import React from "react";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useGetWorkspaceAnalytics } from "@/features/workspaces/api/use-get-workspace-analytics";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useCollegePersona } from "@/features/college/hooks/use-college-persona";

import { DashboardSkeleton } from "./dashboard-skeleton";
import { StartupDashboardView } from "./dashboard/startup-dashboard-view";
import { CollegeHodDashboardView } from "./dashboard/college-hod-dashboard-view";
import { CollegeGuideDashboardView } from "./dashboard/college-guide-dashboard-view";
import { CollegeStudentDashboardView } from "./dashboard/college-student-dashboard-view";

export { DashboardSkeleton } from "./dashboard-skeleton";

interface WorkspaceDashboardProps {
  workspaceId?: string;
}

/**
 * Startup dashboard data container with TanStack Query hooks
 */
const StartupDashboardContainer: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const { data: analytics, isLoading: isLoadingAnalytics } = useGetWorkspaceAnalytics({ workspaceId });
  const { data: tasks, isLoading: isLoadingTasks } = useGetTasks({ workspaceId });
  const { data: projects, isLoading: isLoadingProjects } = useGetProjects({ workspaceId });
  const { data: members, isLoading: isLoadingMembers } = useGetMembers({ workspaceId });

  return (
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
  );
};

/**
 * Strict Dashboard Router for OrbitWork.
 * Strictly dispatches according to workspace archetype and true academic persona:
 * - Render Barrier: <DashboardSkeleton /> until workspace, member, and persona queries settle.
 * - If workspace.type === 'STARTUP' -> StartupDashboard
 * - Else if isHod -> CollegeHodDashboard
 * - Else if isGuide -> CollegeGuideDashboard
 * - Else if isStudent || isTeamLead -> CollegeStudentDashboard
 * - Default fallback: <DashboardSkeleton />
 */
export const WorkspaceDashboard: React.FC<WorkspaceDashboardProps> = ({
  workspaceId: workspaceIdProp,
}) => {
  const currentWorkspaceId = useWorkspaceId();
  const workspaceId = workspaceIdProp || currentWorkspaceId;

  const { data: workspace, isLoading: isWorkspaceLoading } = useGetWorkspace({ workspaceId });
  const { isLoading: isMemberLoading } = useCurrentMember({ workspaceId });
  const {
    isHod,
    isGuide,
    isStudent,
    isTeamLead,
    isLoading: isPersonaLoading,
  } = useCollegePersona(workspaceId);

  // 1. Explicit Render Barrier: Prevent partial layouts or role flashes while settling
  if (isWorkspaceLoading || isPersonaLoading || isMemberLoading || !workspace) {
    return <DashboardSkeleton />;
  }

  // 2. Startup Workspace Mode
  if (workspace.type === "STARTUP") {
    return <StartupDashboardContainer workspaceId={workspaceId} />;
  }

  // 3. College Workspace Mode: Strictly persona-driven
  if (isHod) {
    return <CollegeHodDashboardView workspace={workspace} />;
  }

  if (isGuide) {
    return <CollegeGuideDashboardView workspace={workspace} />;
  }

  if (isStudent || isTeamLead) {
    return <CollegeStudentDashboardView workspace={workspace} />;
  }

  // Fallback while persona resolves or if unassigned
  return <DashboardSkeleton />;
};
