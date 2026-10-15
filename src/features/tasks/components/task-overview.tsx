import {
  PencilIcon,
  CheckSquare,
  Bug,
  Bookmark,
  Zap,
  Clock,
  Hash,
} from "lucide-react";

import { MemberAvatar } from "@/features/members/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { snakeCaseToTitleCase } from "@/lib/utils";
import { DottedSeparator } from "@/components/dotted-separator";

import { TaskDate } from "./task-date";
import { OverviewProperty } from "./overview-property";

import { Task, TaskPriority, TaskType } from "../types";
import { useEditTaskModal } from "../hooks/use-edit-task-modal";
import { usePermissions } from "@/hooks/use-permissions";

interface TaskOverviewProps {
  task: Task;
}

const getPriorityBadgeClass = (priority?: TaskPriority) => {
  switch (priority) {
    case TaskPriority.URGENT:
      return "bg-rose-500/15 text-rose-600 border-rose-300 dark:border-rose-800";
    case TaskPriority.HIGH:
      return "bg-amber-500/15 text-amber-600 border-amber-300 dark:border-amber-800";
    case TaskPriority.MEDIUM:
      return "bg-blue-500/15 text-blue-600 border-blue-300 dark:border-blue-800";
    case TaskPriority.LOW:
      return "bg-emerald-500/15 text-emerald-600 border-emerald-300 dark:border-emerald-800";
    default:
      return "bg-slate-500/15 text-slate-600 border-slate-300 dark:border-slate-800";
  }
};

const getTypeIcon = (type?: TaskType) => {
  switch (type) {
    case TaskType.BUG:
      return <Bug className="size-3.5 text-rose-500 mr-1" />;
    case TaskType.STORY:
      return <Bookmark className="size-3.5 text-emerald-500 mr-1" />;
    case TaskType.EPIC:
      return <Zap className="size-3.5 text-purple-500 mr-1" />;
    default:
      return <CheckSquare className="size-3.5 text-blue-500 mr-1" />;
  }
};

export const TaskOverview = ({ task }: TaskOverviewProps) => {
  const { open } = useEditTaskModal();
  const { can } = usePermissions(task.workspaceId);
  const canEdit = can("edit_task", {
    reporterId: task.reporterId,
    assigneeId: task.assigneeId,
  });

  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-muted rounded-lg p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Overview</p>
          {canEdit && (
            <Button
              onClick={() => open(task.$id || task.id)}
              size="sm"
              variant="secondary"
            >
              <PencilIcon className="size-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
        <DottedSeparator className="my-4" />
        <div className="flex flex-col gap-y-4">
          <OverviewProperty label="Issue Type">
            <div className="flex items-center text-sm font-medium">
              {getTypeIcon(task.type)}
              <span>{task.type || "TASK"}</span>
            </div>
          </OverviewProperty>

          <OverviewProperty label="Priority">
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getPriorityBadgeClass(
                task.priority
              )}`}
            >
              {task.priority || "MEDIUM"}
            </span>
          </OverviewProperty>

          <OverviewProperty label="Assignee">
            <MemberAvatar name={task.assignee.name} className="size-6" />
            <p className="text-sm font-medium">{task.assignee.name}</p>
          </OverviewProperty>

          {task.reporter && (
            <OverviewProperty label="Reporter">
              <MemberAvatar name={task.reporter.name} className="size-6" />
              <p className="text-sm font-medium">{task.reporter.name}</p>
            </OverviewProperty>
          )}

          <OverviewProperty label="Due Date">
            <TaskDate value={task.dueDate} className="text-sm font-medium" />
          </OverviewProperty>

          <OverviewProperty label="Status">
            <Badge variant={task.status}>
              {snakeCaseToTitleCase(task.status)}
            </Badge>
          </OverviewProperty>

          {task.storyPoints !== null && task.storyPoints !== undefined && (
            <OverviewProperty label="Story Points">
              <div className="flex items-center text-sm font-medium">
                <Hash className="size-3.5 mr-1 text-muted-foreground" />
                {task.storyPoints} pts
              </div>
            </OverviewProperty>
          )}

          {task.estimatedHours !== null && task.estimatedHours !== undefined && (
            <OverviewProperty label="Est. Hours">
              <div className="flex items-center text-sm font-medium">
                <Clock className="size-3.5 mr-1 text-muted-foreground" />
                {task.estimatedHours} hrs
              </div>
            </OverviewProperty>
          )}
        </div>
      </div>
    </div>
  );
};
