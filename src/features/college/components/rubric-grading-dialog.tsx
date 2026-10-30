"use client";

import React, { useState } from "react";
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
import { Loader2, Award, CheckCircle2 } from "lucide-react";
import { useGetSubmissionRubrics } from "../api/use-get-submission-rubrics";
import { useGradeSubmission } from "../api/use-grade-submission";

interface RubricGradingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string | null;
}

export const RubricGradingDialog: React.FC<RubricGradingDialogProps> = ({
  open,
  onOpenChange,
  submissionId,
}) => {
  const { data, isLoading } = useGetSubmissionRubrics({ submissionId });
  const { mutate: gradeSubmission, isPending } = useGradeSubmission();

  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"APPROVED" | "CHANGES_REQUESTED">("APPROVED");

  const rubrics = data?.rubrics || [];

  const handleScoreChange = (criteriaId: string, val: number) => {
    setScores((prev) => ({ ...prev, [criteriaId]: val }));
  };

  const handleFeedbackChange = (criteriaId: string, text: string) => {
    setFeedback((prev) => ({ ...prev, [criteriaId]: text }));
  };

  // Calculate live total score
  const totalScore = rubrics.reduce((rubricAcc, r) => {
    return (
      rubricAcc +
      r.criteria.reduce((cAcc, c) => {
        const val = scores[c.id] ?? c.current_score ?? 0;
        return cAcc + Number(val);
      }, 0)
    );
  }, 0);

  const maxTotalScore = rubrics.reduce((rubricAcc, r) => {
    return (
      rubricAcc +
      r.criteria.reduce((cAcc, c) => {
        return cAcc + Number(c.max_score);
      }, 0)
    );
  }, 0);

  const handleSubmitGrade = () => {
    if (!submissionId) return;

    const gradesPayload: {
      rubricCriteriaId: string;
      score: number;
      feedback?: string;
    }[] = [];

    for (const r of rubrics) {
      for (const c of r.criteria) {
        gradesPayload.push({
          rubricCriteriaId: c.id,
          score: scores[c.id] ?? c.current_score ?? 0,
          feedback: feedback[c.id] ?? c.feedback ?? undefined,
        });
      }
    }

    gradeSubmission(
      {
        param: { submissionId },
        json: {
          grades: gradesPayload,
          status,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2">
              <Award className="size-5 text-amber-500" />
              Rubric Evaluation & Grading
            </DialogTitle>
            <div className="text-right">
              <span className="text-xs text-muted-foreground block font-normal">
                Total Score
              </span>
              <span className="text-lg font-bold text-foreground">
                {totalScore} / {maxTotalScore}
              </span>
            </div>
          </div>
          <DialogDescription>
            Score individual rubric criteria according to the student team&apos;s presentation and deliverables.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
            Loading rubric criteria...
          </div>
        ) : rubrics.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No rubrics defined for this milestone yet.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 py-2 pr-1">
            {rubrics.map((rubric) => (
              <div key={rubric.id} className="space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground border-b pb-1">
                  {rubric.title} (Weightage: {rubric.total_weightage})
                </h4>

                <div className="space-y-4">
                  {rubric.criteria.map((crit) => {
                    const currentVal =
                      scores[crit.id] ?? crit.current_score ?? 0;

                    return (
                      <div
                        key={crit.id}
                        className="p-3 rounded-lg border bg-card/60 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-xs text-foreground">
                              {crit.title}
                            </p>
                            {crit.description && (
                              <p className="text-[11px] text-muted-foreground">
                                {crit.description}
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-muted">
                            {currentVal} / {crit.max_score}
                          </span>
                        </div>

                        {/* Score Input Slider */}
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min={0}
                            max={crit.max_score}
                            step={0.5}
                            value={currentVal}
                            onChange={(e) =>
                              handleScoreChange(crit.id, parseFloat(e.target.value))
                            }
                            className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                          />
                          <Input
                            type="number"
                            min={0}
                            max={crit.max_score}
                            step={0.5}
                            value={currentVal}
                            onChange={(e) =>
                              handleScoreChange(crit.id, parseFloat(e.target.value) || 0)
                            }
                            className="w-16 h-7 text-xs text-center"
                          />
                        </div>

                        {/* Criterion Feedback */}
                        <Input
                          placeholder="Specific feedback note for this criterion..."
                          value={feedback[crit.id] ?? crit.feedback ?? ""}
                          onChange={(e) =>
                            handleFeedbackChange(crit.id, e.target.value)
                          }
                          className="text-xs h-7"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="pt-2 border-t flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Evaluation Verdict:
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={status === "APPROVED" ? "primary" : "outline"}
                  onClick={() => setStatus("APPROVED")}
                  className="text-xs h-8"
                >
                  <CheckCircle2 className="size-3.5 mr-1" />
                  Approve Deliverable
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={status === "CHANGES_REQUESTED" ? "destructive" : "outline"}
                  onClick={() => setStatus("CHANGES_REQUESTED")}
                  className="text-xs h-8"
                >
                  Request Changes
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmitGrade}
            disabled={isPending || rubrics.length === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Saving Evaluation...
              </>
            ) : (
              "Submit Grade"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
