"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import {
  Award,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Upload,
  AlertTriangle,
  Loader2,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useGetTeamMilestones } from "../api/use-get-team-milestones";
import { useSubmitMilestone } from "../api/use-submit-milestone";
import { TeamMilestoneItem } from "../types";

interface StudentMilestonePortalProps {
  teamId: string;
  workspaceId?: string;
}

export const StudentMilestonePortal: React.FC<StudentMilestonePortalProps> = ({
  teamId,
}) => {
  const { data, isLoading, refetch } = useGetTeamMilestones({ teamId });
  const { mutate: submitMilestone, isPending: isSubmitting } = useSubmitMilestone();

  const [activeSubmittingMilestone, setActiveSubmittingMilestone] =
    useState<TeamMilestoneItem | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");

  const handleOpenSubmit = (m: TeamMilestoneItem) => {
    setActiveSubmittingMilestone(m);
    setFileUrl(m.submission?.file_url || "");
    setNotes(m.submission?.notes || "");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubmittingMilestone || !fileUrl.trim()) return;

    submitMilestone(
      {
        param: { milestoneId: activeSubmittingMilestone.id },
        json: {
          teamId,
          fileUrl: fileUrl.trim(),
          notes: notes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setActiveSubmittingMilestone(null);
          setFileUrl("");
          setNotes("");
          refetch();
        },
      }
    );
  };

  const team = data?.team;
  const batch = data?.batch;
  const milestones = data?.milestones || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border bg-card/60">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Award className="size-5 text-indigo-500" />
              Project Milestones & Deliverables
            </h3>
            <Badge variant="outline" className="text-[10px] font-semibold">
              GROUP PORTAL
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            {team ? `${team.team_code} • ${team.title}` : "Capstone Project"}.
            Submit project reports, presentation slides, and source code links for faculty review cycles.
          </p>
        </div>

        {batch && (
          <Badge variant="secondary" className="text-xs self-start sm:self-auto font-medium">
            {batch.department} • {batch.name}
          </Badge>
        )}
      </div>

      {/* 2. Step-by-Step Deliverables Cards */}
      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-36 rounded-2xl bg-muted/40" />
          <div className="h-36 rounded-2xl bg-muted/40" />
        </div>
      ) : milestones.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-2xl space-y-2 bg-muted/10">
          <Award className="size-9 mx-auto text-muted-foreground stroke-1" />
          <h4 className="font-bold text-sm text-foreground">
            No milestones configured for this batch yet
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Your department coordinator will publish the defense deadlines and submission criteria here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {milestones.map((m, idx) => {
            const isApproved = m.status === "APPROVED";
            const isSubmitted = m.status === "SUBMITTED";
            const isChanges = m.status === "CHANGES_REQUESTED";
            const isOverdue = m.status === "OVERDUE";

            return (
              <div
                key={m.id}
                className={`p-5 rounded-2xl border transition-all space-y-4 shadow-xs ${
                  isApproved
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : isChanges
                    ? "bg-orange-500/5 border-orange-500/30"
                    : isSubmitted
                    ? "bg-amber-500/5 border-amber-500/30"
                    : isOverdue
                    ? "bg-destructive/5 border-destructive/30"
                    : "bg-card hover:border-border"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                        Milestone {idx + 1}
                      </span>

                      {isApproved ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 text-[10px] gap-1 font-bold">
                          <CheckCircle2 className="size-3" />
                          Approved & Evaluated
                        </Badge>
                      ) : isSubmitted ? (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 text-[10px] gap-1 font-medium">
                          <Clock className="size-3" />
                          Under Faculty Review
                        </Badge>
                      ) : isChanges ? (
                        <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-200 text-[10px] gap-1 font-bold">
                          <AlertCircle className="size-3" />
                          Revisions Requested
                        </Badge>
                      ) : isOverdue ? (
                        <Badge variant="destructive" className="text-[10px] gap-1 font-medium">
                          <AlertTriangle className="size-3" />
                          Submission Overdue
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Pending Submission
                        </Badge>
                      )}

                      <span className="text-[11px] text-muted-foreground font-medium">
                        • {m.countdown_label}
                      </span>
                    </div>

                    <h4 className="font-bold text-base text-foreground">
                      {m.title}
                    </h4>

                    {m.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
                        {m.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start">
                    <span className="text-xs font-bold text-muted-foreground">
                      Weightage: <strong className="text-foreground">{m.max_marks} marks</strong>
                    </span>
                  </div>
                </div>

                {/* Feedback or Grade Banner */}
                {isApproved && m.grade && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        Accredited Marks Awarded:
                      </span>
                      <span className="font-black text-sm text-emerald-700 dark:text-emerald-400">
                        {m.grade.score} / {m.max_marks}
                      </span>
                    </div>
                    {m.grade.remarks && (
                      <p className="text-foreground/90 italic pt-1">
                        &quot;{m.grade.remarks}&quot;
                      </p>
                    )}
                  </div>
                )}

                {isChanges && m.grade?.remarks && (
                  <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs space-y-1">
                    <span className="font-bold text-destructive flex items-center gap-1.5">
                      <AlertCircle className="size-3.5" />
                      Faculty Guide Feedback / Revision Required:
                    </span>
                    <p className="text-foreground/90 leading-relaxed italic">
                      &quot;{m.grade.remarks}&quot;
                    </p>
                  </div>
                )}

                {/* Submission Details & Action */}
                <div className="pt-2 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  {m.submission ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          Submitted File / Link:
                        </span>
                        <a
                          href={m.submission.file_url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-mono inline-flex items-center gap-1 font-semibold"
                        >
                          <ExternalLink className="size-3" />
                          View Deliverable (v{m.submission.version})
                        </a>
                      </div>
                      {m.submission.submitted_at && (
                        <p className="text-[10px] text-muted-foreground">
                          Submitted on {format(new Date(m.submission.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">
                      No document or report submitted yet for this milestone.
                    </span>
                  )}

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {(!isApproved || isChanges) && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenSubmit(m)}
                        className={`gap-1.5 text-xs font-semibold ${
                          isChanges
                            ? "bg-orange-600 hover:bg-orange-700 text-white"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        <Upload className="size-3.5" />
                        {isChanges ? "Revise & Re-Submit" : m.submission ? "Update Submission" : "Submit Deliverable"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Submit Deliverable Modal */}
      <Dialog
        open={Boolean(activeSubmittingMilestone)}
        onOpenChange={(open) => !open && setActiveSubmittingMilestone(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                {team?.team_code}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {activeSubmittingMilestone?.max_marks} marks
              </Badge>
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              {activeSubmittingMilestone?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Upload your group report, presentation slide deck, or repository link for faculty guide evaluation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="fileUrl" className="text-xs font-semibold">
                Deliverable URL (Google Drive, GitHub, PDF Link) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fileUrl"
                type="url"
                placeholder="https://drive.google.com/... or https://github.com/..."
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                required
                className="text-xs h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                Ensure permissions are set to &quot;Anyone with the link can view&quot;.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold">
                Work Summary & Notes for Faculty Guide (Optional)
              </Label>
              <Textarea
                id="notes"
                placeholder="Briefly state key sections completed, modules implemented, or presentation talking points..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveSubmittingMilestone(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!fileUrl.trim() || isSubmitting}
                className="gap-1.5 font-semibold bg-primary text-primary-foreground"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" />
                    Submit for Review
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
