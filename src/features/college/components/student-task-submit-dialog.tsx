"use client";

import React, { useState, useEffect } from "react";
import {
  Upload,
  AlertCircle,
  Link as LinkIcon,
  Loader2,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Task } from "@/features/tasks/types";
import { useSubmitTaskWork } from "../api/use-submit-task-work";

interface StudentTaskSubmitDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const StudentTaskSubmitDialog: React.FC<StudentTaskSubmitDialogProps> = ({
  task,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionFileUrl, setSubmissionFileUrl] = useState("");

  const { mutate: submitWork, isPending } = useSubmitTaskWork();

  useEffect(() => {
    if (task) {
      setSubmissionNotes(task.submission_notes || "");
      setSubmissionFileUrl(task.submission_file_url || "");
    } else {
      setSubmissionNotes("");
      setSubmissionFileUrl("");
    }
  }, [task]);

  if (!task) return null;

  const isChangesRequested =
    task.verification_status === "CHANGES_REQUESTED" ||
    task.review_status === "CHANGES_REQUESTED";

  const feedbackText = task.reviewer_feedback || task.guide_feedback;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionNotes.trim()) return;

    submitWork(
      {
        param: { taskId: task.id || (task as unknown as { $id?: string }).$id || "" },
        json: {
          submissionNotes: submissionNotes.trim(),
          submissionFileUrl: submissionFileUrl.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          onClose();
          if (onSuccess) onSuccess();
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted">
              Task Deliverable
            </span>
            {isChangesRequested ? (
              <Badge variant="destructive" className="text-[10px] gap-1">
                <AlertCircle className="size-3" />
                Changes Requested
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Clock className="size-3" />
                Ready for Review
              </Badge>
            )}
          </div>
          <DialogTitle className="text-base font-bold text-foreground">
            {task.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Submit your completed work to your Faculty Guide for evaluation and official sign-off.
          </DialogDescription>
        </DialogHeader>

        {isChangesRequested && feedbackText && (
          <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-xs space-y-1">
            <div className="font-bold text-destructive flex items-center gap-1.5">
              <AlertCircle className="size-3.5" />
              Faculty Guide Revision Notice
            </div>
            <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
              &quot;{feedbackText}&quot;
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="submissionNotes" className="text-xs font-semibold">
              Work Accomplished & Summary <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="submissionNotes"
              placeholder="Explain what you implemented, test cases verified, or deliverable details..."
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              required
              rows={4}
              className="text-xs leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="submissionFileUrl" className="text-xs font-semibold">
              Deliverable Proof / External Link (Optional)
            </Label>
            <div className="relative">
              <LinkIcon className="size-3.5 absolute left-3 top-3 text-muted-foreground" />
              <Input
                id="submissionFileUrl"
                type="url"
                placeholder="https://github.com/... or Google Drive link"
                value={submissionFileUrl}
                onChange={(e) => setSubmissionFileUrl(e.target.value)}
                className="text-xs pl-8 h-9"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Paste GitHub PR/commit URL, Google Drive report link, or demo preview.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!submissionNotes.trim() || isPending}
              className="gap-1.5 bg-primary text-primary-foreground font-semibold"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  Submit for Faculty Sign-Off
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
