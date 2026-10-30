"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import {
  Award,
  Upload,
  Calendar,
  Plus,
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
import { Loader2 } from "lucide-react";

import { useGetMilestones } from "../api/use-get-milestones";
import { useSubmitMilestone } from "../api/use-submit-milestone";
import { useCreateMilestone } from "../api/use-create-milestone";
import { RubricGradingDialog } from "./rubric-grading-dialog";
import { Milestone, AcademicTeam, Batch } from "../types";

interface MilestonesTabProps {
  batch: Batch;
  teams: AcademicTeam[];
  canManage: boolean;
  canGrade: boolean;
  canSubmit: boolean;
}

export const MilestonesTab: React.FC<MilestonesTabProps> = ({
  batch,
  teams,
  canManage,
  canGrade,
  canSubmit,
}) => {
  const { data: milestones = [], isLoading } = useGetMilestones({
    batchId: batch.id,
  });

  const [createMilestoneOpen, setCreateMilestoneOpen] = useState(false);
  const [submissionModalMilestone, setSubmissionModalMilestone] =
    useState<Milestone | null>(null);
  const [selectedSubmissionIdForGrading, setSelectedSubmissionIdForGrading] =
    useState<string | null>(null);

  // Milestone submission state
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");

  const { mutate: submitMilestone, isPending: isSubmitting } =
    useSubmitMilestone();

  // Create milestone form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newMaxMarks, setNewMaxMarks] = useState("100");

  const { mutate: createMilestone, isPending: isCreating } =
    useCreateMilestone();

  const handleCreateMilestone = () => {
    if (!newTitle.trim()) return;

    createMilestone(
      {
        param: { batchId: batch.id },
        json: {
          batchId: batch.id,
          title: newTitle.trim(),
          description: newDesc.trim() || undefined,
          dueDate: newDueDate ? new Date(newDueDate) : undefined,
          maxMarks: parseFloat(newMaxMarks) || 100,
          criteria: [
            {
              title: "Problem Understanding & Architecture",
              maxScore: 25,
            },
            {
              title: "Implementation & Technical Depth",
              maxScore: 35,
            },
            {
              title: "Demonstration & Viva Defence",
              maxScore: 25,
            },
            {
              title: "Documentation & Report Quality",
              maxScore: 15,
            },
          ],
        },
      },
      {
        onSuccess: () => {
          setCreateMilestoneOpen(false);
          setNewTitle("");
          setNewDesc("");
          setNewDueDate("");
        },
      }
    );
  };

  const handleSubmitMilestone = () => {
    if (!submissionModalMilestone || !selectedTeamId || !fileUrl.trim()) return;

    submitMilestone(
      {
        param: { milestoneId: submissionModalMilestone.id },
        json: {
          teamId: selectedTeamId,
          fileUrl: fileUrl.trim(),
          notes: notes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setSubmissionModalMilestone(null);
          setFileUrl("");
          setNotes("");
          setSelectedTeamId("");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-foreground">
            Academic Milestones & Review Cycles
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Progressive review schedule: project synopsis, midterm viva, code review, and final defence.
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => setCreateMilestoneOpen(true)}
            className="gap-1.5"
          >
            <Plus className="size-3.5" />
            Schedule Milestone
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 rounded-xl border bg-muted/30 p-5 space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-5 w-40 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded" />
              </div>
              <div className="h-3 w-3/4 bg-muted/60 rounded" />
              <div className="h-8 w-32 bg-muted/40 rounded mt-4" />
            </div>
          ))}
        </div>
      ) : milestones.length === 0 ? (
        <div className="py-12 border border-dashed rounded-lg text-center space-y-3">
          <Award className="size-8 mx-auto text-muted-foreground" />
          <p className="font-semibold text-sm text-foreground">
            No milestones scheduled yet
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Schedule review checkpoints like Synopsis Defense, Project Review 1, or Final Presentation to begin tracking team submissions.
          </p>
          {canManage && (
            <Button
              size="sm"
              onClick={() => setCreateMilestoneOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              Schedule First Milestone
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {milestones.map((m, index) => {
            const hasSubmission = Boolean(m.my_submission);
            const status = m.my_submission?.status;

            return (
              <div
                key={m.id}
                className="p-4 rounded-xl border bg-card hover:border-primary/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground">
                        {m.title}
                      </h4>
                      <Badge variant="secondary" className="text-[10px]">
                        Max Marks: {m.max_marks}
                      </Badge>
                      {status && (
                        <Badge
                          variant={
                            status === "APPROVED"
                              ? "default"
                              : status === "CHANGES_REQUESTED"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {status.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                    {m.description && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                        {m.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground mt-2">
                      {m.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          Due: {format(new Date(m.due_date), "MMM d, yyyy")}
                        </span>
                      )}
                      <span>
                        Submissions: <strong>{m.submissions_count || 0}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {canSubmit && (
                    <Button
                      size="sm"
                      variant={hasSubmission ? "outline" : "primary"}
                      onClick={() => setSubmissionModalMilestone(m)}
                      className="text-xs h-8 gap-1.5"
                    >
                      <Upload className="size-3.5" />
                      {hasSubmission ? "Re-upload Work" : "Submit Deliverable"}
                    </Button>
                  )}

                  {canGrade && m.my_submission && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setSelectedSubmissionIdForGrading(m.my_submission!.id)
                      }
                      className="text-xs h-8 gap-1.5"
                    >
                      <Award className="size-3.5 text-amber-500" />
                      Grade Submission
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Milestone Modal */}
      <Dialog
        open={createMilestoneOpen}
        onOpenChange={setCreateMilestoneOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Review Milestone</DialogTitle>
            <DialogDescription>
              Set up a defense checkpoint, submission criteria, and evaluation rubrics.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-title">Milestone Title *</Label>
              <Input
                id="m-title"
                placeholder="e.g. Project Synopsis Defence, Review 1"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-desc">Description & Instructions</Label>
              <Textarea
                id="m-desc"
                rows={2}
                placeholder="Guidelines, required deliverables (PDF report, GitHub link)..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-marks">Max Marks</Label>
                <Input
                  id="m-marks"
                  type="number"
                  value={newMaxMarks}
                  onChange={(e) => setNewMaxMarks(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-due">Due Date</Label>
                <Input
                  id="m-due"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateMilestoneOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateMilestone}
              disabled={!newTitle.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                "Schedule Milestone"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Submit Deliverable Modal */}
      <Dialog
        open={Boolean(submissionModalMilestone)}
        onOpenChange={(open) => !open && setSubmissionModalMilestone(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Deliverable</DialogTitle>
            <DialogDescription>
              Submit your project report, prototype link, or GitHub repository for review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select Your Team *</Label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs"
              >
                <option value="">Select your project team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.team_code} - {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sub-file">Deliverable URL (Report / GitHub) *</Label>
              <Input
                id="sub-file"
                placeholder="https://github.com/org/repo or https://drive.google.com/..."
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sub-notes">Submission Notes</Label>
              <Textarea
                id="sub-notes"
                rows={2}
                placeholder="Brief summary of progress accomplished for this checkpoint..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubmissionModalMilestone(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitMilestone}
              disabled={!selectedTeamId || !fileUrl.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Submit Milestone"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rubric Grading Modal */}
      <RubricGradingDialog
        open={Boolean(selectedSubmissionIdForGrading)}
        onOpenChange={(open) => !open && setSelectedSubmissionIdForGrading(null)}
        submissionId={selectedSubmissionIdForGrading}
      />
    </div>
  );
};
