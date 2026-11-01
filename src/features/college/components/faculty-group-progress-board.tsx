"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  ExternalLink,
  Crown,
  KeyRound,
  Copy,
  Check,
  Calendar,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal";
import { TaskOverview } from "@/features/tasks/components/task-overview";
import { TaskComments } from "@/features/tasks/components/task-comments";
import { Task, TaskStatus } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

export interface ProgressBoardTask {
  id: string;
  $id?: string;
  name: string;
  status: TaskStatus;
  verification_status?: string | null;
  review_status?: string | null;
  submission_notes?: string | null;
  submission_file_url?: string | null;
  reviewer_feedback?: string | null;
  guide_feedback?: string | null;
  dueDate?: string | null;
  description?: string | null;
  type?: string | null;
  priority?: string | null;
  assignee?: {
    name?: string;
    email?: string;
    id?: string;
  } | null;
  [key: string]: unknown;
}

interface FacultyGroupProgressBoardProps {
  workspaceId: string;
  group: {
    id: string;
    team_code: string;
    title: string;
    abstract?: string | null;
    batch_name?: string;
    batch_id?: string;
    project_id?: string | null;
    student_join_code: string;
    channel_id?: string | null;
    roster: Array<{
      id: string;
      memberId: string;
      name: string;
      email: string;
      role: "LEAD" | "MEMBER";
    }>;
    tasks?: ProgressBoardTask[];
  };
  onBack: () => void;
  onVerifyTask?: (taskId: string) => void;
  onRequestChanges?: (task: ProgressBoardTask) => void;
  isVerifying?: boolean;
}

export const FacultyGroupProgressBoard: React.FC<FacultyGroupProgressBoardProps> = ({
  workspaceId,
  group,
  onBack,
  onVerifyTask,
  onRequestChanges,
  isVerifying = false,
}) => {
  const { open: openCreateTask } = useCreateTaskModal();
  const [inspectingTask, setInspectingTask] = useState<ProgressBoardTask | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Live query for tasks
  const { data: tasksData } = useGetTasks({
    workspaceId,
    projectId: group.project_id || undefined,
  });

  const tasks: ProgressBoardTask[] =
    (tasksData?.documents as unknown as ProgressBoardTask[]) ||
    group.tasks ||
    [];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(group.student_join_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const todoTasks = tasks.filter(
    (t) => t.status === TaskStatus.TODO || t.status === TaskStatus.BACKLOG
  );
  const inProgressTasks = tasks.filter(
    (t) => t.status === TaskStatus.IN_PROGRESS
  );
  const inReviewTasks = tasks.filter(
    (t) =>
      t.verification_status === "PENDING_GUIDE_REVIEW" ||
      t.status === TaskStatus.IN_REVIEW
  );
  const doneTasks = tasks.filter(
    (t) =>
      t.status === TaskStatus.DONE || t.verification_status === "APPROVED"
  );

  const leadStudent = group.roster.find((m) => m.role === "LEAD");

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Top Header Navigation & Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="h-8 gap-1.5 text-xs font-semibold mr-1"
            >
              <ArrowLeft className="size-3.5" />
              Back to All Groups
            </Button>
            <Badge className="font-mono text-xs font-bold px-2.5 py-0.5 bg-purple-600 text-white">
              {group.team_code}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              {group.batch_name}
            </span>
            {leadStudent && (
              <Badge variant="outline" className="text-[11px] gap-1 text-purple-600 border-purple-300">
                <Crown className="size-3" />
                Lead: {leadStudent.name}
              </Badge>
            )}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {group.title}
          </h1>
          {group.abstract && (
            <p className="text-xs text-muted-foreground max-w-2xl line-clamp-1">
              {group.abstract}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Join Code Copy */}
          <button
            type="button"
            onClick={handleCopyCode}
            title="Click to copy join code"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary font-mono text-xs font-bold transition-colors"
          >
            <KeyRound className="size-3.5" />
            <span>{group.student_join_code}</span>
            {copiedCode ? (
              <Check className="size-3 text-emerald-500 ml-0.5" />
            ) : (
              <Copy className="size-3 opacity-60 ml-0.5" />
            )}
          </button>

          {/* Group Chat Shortcut */}
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-medium" asChild>
            <Link
              href={
                group.channel_id
                  ? `/workspaces/${workspaceId}/chat?channelId=${group.channel_id}`
                  : `/workspaces/${workspaceId}/chat`
              }
            >
              <MessageSquare className="size-3.5" />
              Group Chat
            </Link>
          </Button>

          {/* Add Guidance Task Button */}
          <Button
            size="sm"
            onClick={openCreateTask}
            className="h-8 gap-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
          >
            <Plus className="size-3.5" />
            Add Guidance Task
          </Button>
        </div>
      </div>

      {/* ── 4-Column Progress Board ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Column 1: Todo */}
        <div className="rounded-xl border bg-muted/20 p-3.5 space-y-3 flex flex-col min-h-[320px]">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground pb-2 border-b">
            <span>Todo</span>
            <Badge variant="secondary" className="text-[10px]">
              {todoTasks.length}
            </Badge>
          </div>
          <div className="space-y-2.5 flex-1">
            {todoTasks.map((t) => (
              <div
                key={t.$id || t.id}
                onClick={() => setInspectingTask(t)}
                className="p-3 rounded-lg border bg-card text-xs space-y-2 shadow-2xs hover:border-primary/50 hover:shadow-xs transition cursor-pointer"
              >
                <div className="flex items-start justify-between gap-1">
                  <p className="font-semibold text-foreground line-clamp-2">
                    {t.name}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t text-[10px] text-muted-foreground">
                  <span className="font-medium truncate max-w-[110px]">
                    {t.assignee?.name || "Unassigned"}
                  </span>
                  {t.dueDate && (
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="size-2.5" />
                      {format(new Date(t.dueDate), "MMM d")}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {todoTasks.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-10">
                No tasks in backlog/todo
              </p>
            )}
          </div>
        </div>

        {/* Column 2: In Progress */}
        <div className="rounded-xl border bg-blue-500/5 border-blue-500/20 p-3.5 space-y-3 flex flex-col min-h-[320px]">
          <div className="flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 pb-2 border-b border-blue-500/20">
            <span>In Progress</span>
            <Badge variant="secondary" className="text-[10px]">
              {inProgressTasks.length}
            </Badge>
          </div>
          <div className="space-y-2.5 flex-1">
            {inProgressTasks.map((t) => {
              const isChanges =
                t.verification_status === "CHANGES_REQUESTED" ||
                t.review_status === "CHANGES_REQUESTED";

              return (
                <div
                  key={t.$id || t.id}
                  onClick={() => setInspectingTask(t)}
                  className={cn(
                    "p-3 rounded-lg border bg-card text-xs space-y-2 shadow-2xs hover:border-blue-400 hover:shadow-xs transition cursor-pointer border-l-2",
                    isChanges
                      ? "border-l-amber-500 bg-amber-500/5"
                      : "border-l-blue-500"
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-semibold text-foreground line-clamp-2">
                      {t.name}
                    </p>
                    {isChanges && (
                      <Badge
                        variant="destructive"
                        className="text-[9px] px-1 py-0 h-4 shrink-0"
                      >
                        Revision
                      </Badge>
                    )}
                  </div>

                  {isChanges && (t.reviewer_feedback || t.guide_feedback) && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 italic line-clamp-2 bg-background/80 p-1.5 rounded border border-amber-300 dark:border-amber-900/50">
                      &ldquo;{t.reviewer_feedback || t.guide_feedback}&rdquo;
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-2 border-t text-[10px] text-muted-foreground">
                    <span className="font-medium truncate max-w-[110px]">
                      {t.assignee?.name || "Unassigned"}
                    </span>
                    {t.dueDate && (
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="size-2.5" />
                        {format(new Date(t.dueDate), "MMM d")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {inProgressTasks.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-10">
                No tasks currently in progress
              </p>
            )}
          </div>
        </div>

        {/* Column 3: Awaiting Verification */}
        <div className="rounded-xl border bg-amber-500/5 border-amber-500/30 p-3.5 space-y-3 flex flex-col min-h-[320px]">
          <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400 pb-2 border-b border-amber-500/30">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              Awaiting Verification
            </span>
            <Badge className="bg-amber-500 text-white text-[10px] px-2 py-0">
              {inReviewTasks.length}
            </Badge>
          </div>
          <div className="space-y-2.5 flex-1">
            {inReviewTasks.map((t) => (
              <div
                key={t.$id || t.id}
                className="p-3 rounded-lg border bg-card text-xs space-y-2.5 shadow-xs border-l-3 border-l-amber-500"
              >
                <div
                  onClick={() => setInspectingTask(t)}
                  className="cursor-pointer space-y-1 hover:opacity-90"
                >
                  <p className="font-bold text-foreground line-clamp-2">
                    {t.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Assignee: <strong className="text-foreground">{t.assignee?.name || "Student"}</strong>
                  </p>
                  {t.submission_notes && (
                    <p className="text-[10px] text-muted-foreground italic line-clamp-2 bg-muted/40 p-1.5 rounded border border-border">
                      Notes: &ldquo;{t.submission_notes}&rdquo;
                    </p>
                  )}
                  {t.submission_file_url && (
                    <a
                      href={t.submission_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-primary hover:underline flex items-center gap-1 pt-0.5"
                    >
                      <ExternalLink className="size-2.5" />
                      View Submission Proof
                    </a>
                  )}
                </div>

                {/* Faculty Direct Action Controls */}
                <div className="pt-2 border-t flex items-center justify-between gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRequestChanges?.(t)}
                    disabled={isVerifying}
                    className="h-7 px-2 text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-semibold"
                  >
                    Request Changes
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onVerifyTask?.(t.$id || t.id)}
                    disabled={isVerifying}
                    className="h-7 px-2.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow-2xs"
                  >
                    <CheckCircle2 className="size-3" />
                    Sign Off
                  </Button>
                </div>
              </div>
            ))}
            {inReviewTasks.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-10">
                All submitted deliverables verified!
              </p>
            )}
          </div>
        </div>

        {/* Column 4: Signed Off by Guide */}
        <div className="rounded-xl border bg-emerald-500/5 border-emerald-500/20 p-3.5 space-y-3 flex flex-col min-h-[320px]">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 pb-2 border-b border-emerald-500/20">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-3" />
              Signed Off by Guide
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {doneTasks.length}
            </Badge>
          </div>
          <div className="space-y-2.5 flex-1">
            {doneTasks.map((t) => (
              <div
                key={t.$id || t.id}
                onClick={() => setInspectingTask(t)}
                className="p-3 rounded-lg border bg-card text-xs space-y-2 shadow-2xs hover:border-emerald-400 hover:shadow-xs transition cursor-pointer border-l-2 border-l-emerald-500"
              >
                <p className="font-semibold text-foreground line-clamp-2">
                  {t.name}
                </p>
                <div className="flex items-center justify-between gap-2 pt-1 border-t text-[10px] text-muted-foreground">
                  <span>{t.assignee?.name || "Student"}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="size-2.5" />
                    Verified
                  </span>
                </div>
              </div>
            ))}
            {doneTasks.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-10">
                No tasks verified yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Task Details & Comments Dialog ── */}
      {inspectingTask && (
        <Dialog open={!!inspectingTask} onOpenChange={() => setInspectingTask(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap pb-1">
                <Badge variant="outline" className="font-mono text-xs">
                  {group.team_code}
                </Badge>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  {inspectingTask.name}
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
              <div className="space-y-4">
                <TaskOverview task={inspectingTask as unknown as Task} />

                {inspectingTask.description && (
                  <div className="p-4 border rounded-lg bg-card text-card-foreground">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Description & Scope
                    </h4>
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {inspectingTask.description}
                    </p>
                  </div>
                )}

                {inspectingTask.submission_notes && (
                  <div className="p-4 rounded-lg border border-amber-500/25 bg-amber-500/5 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Student Work Notes & Proof
                    </h4>
                    <p className="text-xs text-foreground whitespace-pre-wrap">
                      {inspectingTask.submission_notes}
                    </p>
                    {inspectingTask.submission_file_url && (
                      <Button size="sm" variant="outline" asChild className="text-xs h-7 gap-1 mt-1 font-medium">
                        <a href={inspectingTask.submission_file_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-3" />
                          Open Submission Proof / Link
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Task Comments with Active Write Box */}
              <div>
                <TaskComments taskId={inspectingTask.$id || inspectingTask.id} />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between border-t pt-4 mt-2 gap-2">
              <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
                <Link href={`/workspaces/${workspaceId}/tasks/${inspectingTask.$id || inspectingTask.id}`}>
                  Open Dedicated Page →
                </Link>
              </Button>

              <div className="flex items-center gap-2">
                {inspectingTask.verification_status === "PENDING_GUIDE_REVIEW" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onRequestChanges?.(inspectingTask);
                        setInspectingTask(null);
                      }}
                      className="text-amber-600 border-amber-300 hover:bg-amber-50 text-xs font-medium"
                    >
                      Request Changes
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        onVerifyTask?.(inspectingTask.$id || inspectingTask.id);
                        setInspectingTask(null);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Verify & Sign Off
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => setInspectingTask(null)}>
                  Close
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
