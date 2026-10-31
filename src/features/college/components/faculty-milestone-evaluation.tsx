"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import {
  Award,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Users,
  Loader2,
  Sparkles,
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
import { toast } from "sonner";

import { useGetGuideSubmissions } from "../api/use-get-guide-submissions";
import { useGradeSubmission } from "../api/use-grade-submission";
import { Batch, GuideSubmissionItem } from "../types";

interface FacultyMilestoneEvaluationProps {
  workspaceId: string;
  batches?: Batch[];
  batchId?: string;
}

export const FacultyMilestoneEvaluation: React.FC<FacultyMilestoneEvaluationProps> = ({
  workspaceId,
  batches = [],
  batchId: initialBatchId,
}) => {
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId || "ALL");
  const { data: submissions = [], isLoading, refetch } = useGetGuideSubmissions({
    workspaceId,
    batchId: selectedBatchId === "ALL" ? undefined : selectedBatchId,
  });

  const { mutate: gradeSubmission, isPending: isGrading } = useGradeSubmission();

  const [evaluatingSub, setEvaluatingSub] = useState<GuideSubmissionItem | null>(null);
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({});
  const [criteriaRemarks, setCriteriaRemarks] = useState<Record<string, string>>({});
  const [overallRemarks, setOverallRemarks] = useState("");

  const handleOpenEvaluation = (sub: GuideSubmissionItem) => {
    setEvaluatingSub(sub);

    // Initialize existing scores if present
    const initialScores: Record<string, number> = {};
    const initialRemarks: Record<string, string> = {};

    for (const crit of sub.rubric_criteria) {
      const match = sub.evaluations.find((e) => e.rubric_criteria_id === crit.id);
      initialScores[crit.id] = match ? match.score : crit.max_score;
      if (match?.feedback) initialRemarks[crit.id] = match.feedback;
    }

    setCriteriaScores(initialScores);
    setCriteriaRemarks(initialRemarks);
    setOverallRemarks(sub.remarks || "");
  };

  const handleScoreChange = (criteriaId: string, val: string, maxScore: number) => {
    const num = parseFloat(val);
    if (isNaN(num)) {
      setCriteriaScores((prev) => ({ ...prev, [criteriaId]: 0 }));
    } else {
      const clamped = Math.max(0, Math.min(num, maxScore));
      setCriteriaScores((prev) => ({ ...prev, [criteriaId]: clamped }));
    }
  };

  const calculateTotal = (): number => {
    return Object.values(criteriaScores).reduce((acc, curr) => acc + (curr || 0), 0);
  };

  const handleSubmitEvaluation = (status: "APPROVED" | "CHANGES_REQUESTED") => {
    if (!evaluatingSub) return;

    if (status === "CHANGES_REQUESTED" && !overallRemarks.trim()) {
      toast.error("Please enter specific remarks explaining what revisions are needed.");
      return;
    }

    const gradesPayload = evaluatingSub.rubric_criteria.map((c) => ({
      rubricCriteriaId: c.id,
      score: criteriaScores[c.id] ?? c.max_score,
      feedback: criteriaRemarks[c.id]?.trim() || overallRemarks.trim() || undefined,
    }));

    gradeSubmission(
      {
        param: { submissionId: evaluatingSub.submission_id },
        json: {
          grades: gradesPayload,
          status,
        },
      },
      {
        onSuccess: () => {
          setEvaluatingSub(null);
          refetch();
        },
      }
    );
  };

  const totalCalculated = calculateTotal();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border bg-card/60">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Award className="size-5 text-indigo-500" />
              Faculty Milestone Evaluation & Defense
            </h3>
            <Badge variant="outline" className="text-[10px] font-semibold">
              ASSIGNED GROUPS ONLY
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Evaluate milestone deliverables submitted by your assigned capstone groups.
            Score against criteria rubrics, provide feedback, and record marksheet evaluations.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {batches.length > 0 && (
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="h-8 px-2.5 rounded-md border border-input bg-card text-xs font-semibold"
            >
              <option value="ALL">All Cohort Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <Badge variant="secondary" className="text-xs font-medium h-8 px-2.5 flex items-center">
            {submissions.length} Group Deliverable{submissions.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      {/* 2. Submissions Queue */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-28 rounded-xl bg-muted/40" />
          <div className="h-28 rounded-xl bg-muted/40" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-2xl space-y-2 bg-muted/10">
          <CheckCircle2 className="size-9 mx-auto text-emerald-500" />
          <h4 className="font-bold text-sm text-foreground">
            No milestone submissions pending review
          </h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            All submitted reports and presentations from your assigned capstone groups have been reviewed and evaluated.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => {
            const isApproved = sub.status === "APPROVED";
            const isChanges = sub.status === "CHANGES_REQUESTED";

            return (
              <div
                key={sub.submission_id}
                className="p-4 rounded-xl border bg-card hover:border-border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {sub.team_code}
                    </span>
                    <span className="text-xs text-muted-foreground truncate max-w-xs font-medium">
                      {sub.team_title}
                    </span>
                    {isApproved ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 text-[10px] gap-1 font-bold">
                        <CheckCircle2 className="size-3" />
                        Evaluated: {sub.total_score !== null ? `${sub.total_score}/${sub.max_marks}` : "Approved"}
                      </Badge>
                    ) : isChanges ? (
                      <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-200 text-[10px] gap-1 font-medium">
                        <AlertCircle className="size-3" />
                        Revisions Requested
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 text-[10px] gap-1 font-medium">
                        <Clock className="size-3" />
                        Pending Evaluation
                      </Badge>
                    )}
                  </div>

                  <h4 className="font-bold text-sm text-foreground">
                    {sub.milestone_title} (v{sub.version})
                  </h4>

                  {sub.notes && (
                    <p className="text-xs text-muted-foreground italic line-clamp-2">
                      &quot;{sub.notes}&quot;
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pt-1">
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      Submitted by {sub.submitted_by_name}
                    </span>
                    <span>•</span>
                    <span>{format(new Date(sub.submitted_at), "MMM d, yyyy 'at' h:mm a")}</span>
                    {sub.file_url && (
                      <>
                        <span>•</span>
                        <a
                          href={sub.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                        >
                          <ExternalLink className="size-3" />
                          View Deliverable File / Link
                        </a>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <Button
                    size="sm"
                    onClick={() => handleOpenEvaluation(sub)}
                    className="gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Sparkles className="size-3.5" />
                    {isApproved ? "Update Score & Feedback" : "Evaluate & Score Deliverable"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Evaluation & Scoring Dialog */}
      <Dialog open={Boolean(evaluatingSub)} onOpenChange={(open) => !open && setEvaluatingSub(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                {evaluatingSub?.team_code}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {evaluatingSub?.team_title}
              </span>
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Rubric Evaluation — {evaluatingSub?.milestone_title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review deliverables and assign marks per evaluation criteria out of {evaluatingSub?.max_marks} max marks.
            </DialogDescription>
          </DialogHeader>

          {evaluatingSub?.file_url && (
            <div className="p-3 rounded-xl border bg-muted/40 space-y-1 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <ExternalLink className="size-3 text-primary" />
                Submitted Deliverable Document:
              </span>
              <a
                href={evaluatingSub.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono text-[11px] break-all block"
              >
                {evaluatingSub.file_url}
              </a>
              {evaluatingSub.notes && (
                <p className="text-muted-foreground pt-1 italic">
                  &quot;{evaluatingSub.notes}&quot;
                </p>
              )}
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between pb-2 border-b">
              <h5 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Rubric Criteria Breakdown
              </h5>
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <span>Calculated Total:</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black text-sm">
                  {totalCalculated} / {evaluatingSub?.max_marks}
                </span>
              </div>
            </div>

            {evaluatingSub?.rubric_criteria && evaluatingSub.rubric_criteria.length > 0 ? (
              <div className="space-y-3">
                {evaluatingSub.rubric_criteria.map((crit) => (
                  <div key={crit.id} className="p-3 rounded-xl border bg-muted/20 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-xs text-foreground">
                          {crit.title}
                        </p>
                        {crit.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {crit.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number"
                          min="0"
                          max={crit.max_score}
                          value={criteriaScores[crit.id] ?? crit.max_score}
                          onChange={(e) => handleScoreChange(crit.id, e.target.value, crit.max_score)}
                          className="w-16 h-8 text-xs text-center font-bold"
                        />
                        <span className="text-[11px] text-muted-foreground">/ {crit.max_score}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="directScore" className="text-xs font-semibold">
                  Direct Evaluation Score (out of {evaluatingSub?.max_marks})
                </Label>
                <Input
                  id="directScore"
                  type="number"
                  min="0"
                  max={evaluatingSub?.max_marks || 100}
                  value={totalCalculated}
                  onChange={(e) => {
                    const num = parseFloat(e.target.value) || 0;
                    setCriteriaScores({ default: num });
                  }}
                  className="w-24 text-xs font-bold"
                />
              </div>
            )}

            <div className="space-y-1.5 pt-2">
              <Label htmlFor="remarks" className="text-xs font-semibold">
                Faculty Remarks & Actionable Feedback
              </Label>
              <Textarea
                id="remarks"
                placeholder="Detail strengths, gaps in implementation, or required corrections before viva defense..."
                value={overallRemarks}
                onChange={(e) => setOverallRemarks(e.target.value)}
                rows={3}
                className="text-xs leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSubmitEvaluation("CHANGES_REQUESTED")}
              disabled={isGrading}
              className="text-destructive hover:bg-destructive/10 border-destructive/30 text-xs font-semibold"
            >
              Request Re-Submission
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => handleSubmitEvaluation("APPROVED")}
              disabled={isGrading}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
            >
              {isGrading && <Loader2 className="size-3.5 animate-spin" />}
              <CheckCircle2 className="size-3.5" />
              Sign Off & Approve (Submit Marks)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
