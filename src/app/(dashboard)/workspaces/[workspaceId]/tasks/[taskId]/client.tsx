"use client";

import { useGetTask } from "@/features/tasks/api/use-get-task";
import { useTaskId } from "@/features/tasks/hooks/use-task-id";
import { TaskOverview } from "@/features/tasks/components/task-overview";
import { TaskBreadcrumbs } from "@/features/tasks/components/task-breadcrumbs";
import { TaskDescription } from "@/features/tasks/components/task-description";
import { TaskComments } from "@/features/tasks/components/task-comments";
import { TaskActivityLog } from "@/features/tasks/components/task-activity-log";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { DottedSeparator } from "@/components/dotted-separator";

export const TaskIdClient = () => {
  const taskId = useTaskId();
  const { data, isLoading } = useGetTask({ taskId });

  if (isLoading) {
    return <PageLoader />
  }

  if (!data) {
    return <PageError message="Task not found" />
  }

  return (
    <div className="flex flex-col gap-y-6">
      <TaskBreadcrumbs project={data.project} task={data} />
      <DottedSeparator />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-y-6">
          <TaskOverview task={data} />
          <TaskDescription task={data} />
        </div>
        <div className="flex flex-col gap-y-6">
          <TaskComments taskId={taskId} />
          <TaskActivityLog taskId={taskId} />
        </div>
      </div>
    </div>
  );
};
