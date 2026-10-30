"use client";

import React from "react";
import { Analytics, AnalyticsSkeleton } from "@/components/analytics";
import {
  TaskList,
  ProjectList,
  MembersList,
  TaskListSkeleton,
  ProjectListSkeleton,
  MembersListSkeleton,
} from "../dashboard-widgets";
import { Task } from "@/features/tasks/types";
import { Project } from "@/features/projects/types";
import { Member } from "@/features/members/types";
import { WorkspaceAnalyticsResponseType } from "@/features/workspaces/api/use-get-workspace-analytics";

interface StartupDashboardViewProps {
  analytics?: WorkspaceAnalyticsResponseType["data"];
  isLoadingAnalytics: boolean;
  tasks?: { documents: Task[]; total: number };
  isLoadingTasks: boolean;
  projects?: { documents: Project[]; total: number };
  isLoadingProjects: boolean;
  members?: { documents: Member[]; total: number };
  isLoadingMembers: boolean;
}

export const StartupDashboardView: React.FC<StartupDashboardViewProps> = ({
  analytics,
  isLoadingAnalytics,
  tasks,
  isLoadingTasks,
  projects,
  isLoadingProjects,
  members,
  isLoadingMembers,
}) => {
  return (
    <div className="space-y-4">
      {isLoadingAnalytics || !analytics ? (
        <AnalyticsSkeleton />
      ) : (
        <Analytics data={analytics} />
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {isLoadingTasks || !tasks ? (
          <TaskListSkeleton />
        ) : (
          <TaskList data={tasks.documents} total={tasks.total} />
        )}
        {isLoadingProjects || !projects ? (
          <ProjectListSkeleton />
        ) : (
          <ProjectList data={projects.documents} total={projects.total} />
        )}
        {isLoadingMembers || !members ? (
          <MembersListSkeleton />
        ) : (
          <MembersList data={members.documents} total={members.total} />
        )}
      </div>
    </div>
  );
};
