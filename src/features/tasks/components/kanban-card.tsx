import React, { memo } from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  Bug,
  CheckSquare,
  Bookmark,
  Zap,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
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

export const KanbanCard = memo(({ task }: KanbanCardProps) => {
  const workspaceId = useWorkspaceId();
  const taskId = task.$id || task.id;

  return (
    <div className="bg-white dark:bg-neutral-900 p-3 mb-2 rounded-md shadow-sm border border-neutral-200/80 dark:border-neutral-800 space-y-2.5 hover:border-neutral-300 dark:hover:border-neutral-700 transition">
      <div className="flex items-start justify-between gap-x-2">
        <Link
          href={`/workspaces/${workspaceId}/tasks/${taskId}`}
          className="flex items-start gap-x-1.5 flex-1 min-w-0 group cursor-pointer"
        >
          <div className="mt-0.5">{getTypeIcon(task.type)}</div>
          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition">
            {task.name}
          </p>
        </Link>
        <TaskActions id={taskId} projectId={task.projectId} task={task}>
          <MoreHorizontal className="size-4 shrink-0 text-muted-foreground hover:text-foreground transition cursor-pointer" />
        </TaskActions>
      </div>

      <div className="flex items-center gap-x-2 flex-wrap text-xs text-muted-foreground">
        {getPriorityDot(task.priority)}
        {task.storyPoints !== null && task.storyPoints !== undefined && (
          <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold text-muted-foreground">
            {task.storyPoints} pts
          </span>
        )}
        {task.verification_status === "PENDING_GUIDE_REVIEW" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-medium" title="Pending Guide Sign-off">
            <Clock className="size-2.5" />
            Guide Review
          </span>
        )}
        {task.verification_status === "CHANGES_REQUESTED" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-medium" title="Changes Requested by Guide">
            <AlertCircle className="size-2.5" />
            Changes Req
          </span>
        )}
        {task.verification_status === "APPROVED" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-medium" title="Verified by Faculty Guide">
            <CheckCircle2 className="size-2.5" />
            Guide Verified
          </span>
        )}
      </div>

      <DottedSeparator />

      <div className="flex items-center justify-between gap-x-2">
        <div className="flex items-center gap-x-1.5">
          {task.assignee ? (
            <MemberAvatar
              name={task.assignee.name}
              className="size-5"
              fallbackClassName="text-[9px]"
            />
          ) : (
            <span className="text-[10px] text-muted-foreground italic">Unassigned</span>
          )}
          <TaskDate value={task.dueDate} className="text-xs" />
        </div>

        {task.project && (
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
        )}
      </div>
    </div>
  );
});

KanbanCard.displayName = "KanbanCard";
