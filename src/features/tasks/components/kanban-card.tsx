import {
  MoreHorizontal,
  Bug,
  CheckSquare,
  Bookmark,
  Zap,
} from "lucide-react";

import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { DottedSeparator } from "@/components/dotted-separator";

import { TaskDate } from "./task-date";
import { TaskActions } from "./task-actions";

import { Task, TaskPriority, TaskType } from "../types";

interface KanbanCardProps {
  task: Task;
}

const getTypeIcon = (type?: TaskType) => {
  switch (type) {
    case TaskType.BUG:
      return <Bug className="size-3.5 text-rose-500 shrink-0" />;
    case TaskType.STORY:
      return <Bookmark className="size-3.5 text-emerald-500 shrink-0" />;
    case TaskType.EPIC:
      return <Zap className="size-3.5 text-purple-500 shrink-0" />;
    default:
      return <CheckSquare className="size-3.5 text-blue-500 shrink-0" />;
  }
};

const getPriorityDot = (priority?: TaskPriority) => {
  switch (priority) {
    case TaskPriority.URGENT:
      return <span className="size-2 rounded-full bg-rose-500" title="Urgent" />;
    case TaskPriority.HIGH:
      return <span className="size-2 rounded-full bg-amber-500" title="High" />;
    case TaskPriority.LOW:
      return <span className="size-2 rounded-full bg-emerald-500" title="Low" />;
    default:
      return <span className="size-2 rounded-full bg-blue-500" title="Medium" />;
  }
};

export const KanbanCard = ({ task }: KanbanCardProps) => {
  return (
    <div className="bg-white dark:bg-neutral-900 p-3 mb-2 rounded-md shadow-sm border border-neutral-200/80 dark:border-neutral-800 space-y-2.5 hover:border-neutral-300 dark:hover:border-neutral-700 transition">
      <div className="flex items-start justify-between gap-x-2">
        <div className="flex items-start gap-x-1.5 flex-1 min-w-0">
          <div className="mt-0.5">{getTypeIcon(task.type)}</div>
          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
            {task.name}
          </p>
        </div>
        <TaskActions id={task.$id || task.id} projectId={task.projectId} task={task}>
          <MoreHorizontal className="size-4 shrink-0 text-muted-foreground hover:text-foreground transition" />
        </TaskActions>
      </div>

      <div className="flex items-center gap-x-2 flex-wrap text-xs text-muted-foreground">
        {getPriorityDot(task.priority)}
        {task.storyPoints !== null && task.storyPoints !== undefined && (
          <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold text-muted-foreground">
            {task.storyPoints} pts
          </span>
        )}
      </div>

      <DottedSeparator />

      <div className="flex items-center justify-between gap-x-2">
        <div className="flex items-center gap-x-1.5">
          <MemberAvatar
            name={task.assignee.name}
            className="size-5"
            fallbackClassName="text-[9px]"
          />
          <TaskDate value={task.dueDate} className="text-xs" />
        </div>

        <div className="flex items-center gap-x-1.5 max-w-[120px] truncate">
          <ProjectAvatar
            name={task.project.name}
            image={task.project.imageUrl}
            className="size-4 shrink-0"
            fallbackClassName="text-[8px]"
          />
          <span className="text-[11px] font-medium truncate text-muted-foreground">
            {task.project.name}
          </span>
        </div>
      </div>
    </div>
  );
};
