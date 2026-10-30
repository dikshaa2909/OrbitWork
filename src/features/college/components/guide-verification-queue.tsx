"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  MessageSquare,
  Loader2,
  Calendar,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useGetPendingTasks } from "../api/use-get-pending-tasks";
import { useVerifyTask } from "../api/use-verify-task";
import { GuideTaskVerificationItem } from "../types";

interface GuideVerificationQueueProps {
  workspaceId: string;
  batchId?: string;
}

export const GuideVerificationQueue: React.FC<GuideVerificationQueueProps> = ({
  workspaceId,
  batchId,
}) => {
  const { data: tasks = [], isLoading } = useGetPendingTasks({
    workspaceId,
    batchId,
  });

  const { mutate: verifyTask, isPending: isVerifying } = useVerifyTask();

  const [activeTaskForChanges, setActiveTaskForChanges] =
    useState<GuideTaskVerificationItem | null>(null);
  const [remarks, setRemarks] = useState("");

  const handleApprove = (task: GuideTaskVerificationItem) => {
    verifyTask({
      param: { taskId: task.id },
      json: { decision: "APPROVED" },
    });
  };

  const handleRequestChanges = () => {
    if (!activeTaskForChanges || !remarks.trim()) return;

    verifyTask(
      {
        param: { taskId: activeTaskForChanges.id },
        json: {
          decision: "CHANGES_REQUESTED",
          feedback: remarks.trim(),
        },
      },
      {
        onSuccess: () => {
          setActiveTaskForChanges(null);
          setRemarks("");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Changes Request Remarks Dialog */}
      <Dialog
        open={Boolean(activeTaskForChanges)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveTaskForChanges(null);
            setRemarks("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <AlertCircle className="size-5" />
              Request Task Changes
            </DialogTitle>
            <DialogDescription>
              Specify the required corrections or missing deliverables for{" "}
              <strong className="text-foreground">
                {activeTaskForChanges?.name}
              </strong>
              . This will push the task back to IN_PROGRESS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="remarks" className="text-xs font-semibold">
              Faculty Guide Instructions / Remarks{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="remarks"
              placeholder="e.g. Please add unit tests and provide screenshots of the system demo before resubmitting."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="min-h-[100px] text-xs"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveTaskForChanges(null)}
              disabled={isVerifying}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!remarks.trim() || isVerifying}
              onClick={handleRequestChanges}
              className="gap-1.5"
            >
              {isVerifying && <Loader2 className="size-3.5 animate-spin" />}
              Send Revision Notice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="size-4 text-amber-500" />
            Faculty Guide Verification Queue
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review completed work submitted by your assigned capstone groups
            before signing off into DONE.
          </p>
        </div>

        <Badge variant="outline" className="text-xs self-start sm:self-auto">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"} pending review
        </Badge>
      </div>

      {/* Task Queue List */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl border bg-muted/30 p-4 space-y-2"
            >
              <div className="h-4 w-1/3 bg-muted rounded" />
              <div className="h-3 w-1/4 bg-muted/60 rounded" />
              <div className="h-8 w-44 bg-muted/40 rounded mt-3" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-xl space-y-2">
          <CheckCircle2 className="size-9 mx-auto text-emerald-500" />
          <h4 className="font-bold text-sm text-foreground">
            Verification Queue is Empty
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            All submitted deliverables from your capstone groups have been signed
            off. New task submissions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="p-4 rounded-xl border bg-card hover:border-neutral-300 dark:hover:border-neutral-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
            >
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono text-[10px] font-bold">
                    {task.team_code}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate max-w-xs">
                    {task.team_title}
                  </span>
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 text-[10px] gap-1">
                    <Clock className="size-2.5" />
                    Pending Sign-Off
                  </Badge>
                </div>

                <h4 className="font-bold text-sm text-foreground">
                  {task.name}
                </h4>

                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <User className="size-3 text-muted-foreground/70" />
                    <span>Assignee: {task.assignee_name}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-3 text-muted-foreground/70" />
                    <span>
                      Due: {format(new Date(task.due_date), "MMM d, yyyy")}
                    </span>
                  </div>

                  {task.guide_feedback && (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <MessageSquare className="size-3" />
                      <span className="truncate max-w-xs italic">
                        &quot;{task.guide_feedback}&quot;
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                  <Link href={`/workspaces/${workspaceId}/tasks/${task.id}`}>
                    Inspect Task
                    <ExternalLink className="size-3 ml-1" />
                  </Link>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTaskForChanges(task)}
                  disabled={isVerifying}
                  className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                >
                  Request Changes
                </Button>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleApprove(task)}
                  disabled={isVerifying}
                  className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="size-3.5" />
                  Verify & Sign Off
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
