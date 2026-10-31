"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Users,
  GraduationCap,
  Clock,
  MessageSquare,
  Plus,
  Upload,
  FileText,
  Loader2,
  Link as LinkIcon,
  CheckCircle2,
  Send,
  Calendar,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DottedSeparator } from "@/components/dotted-separator";
import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal";
import { InviteGroupStudentsDialog } from "@/features/college/components/invite-group-students-dialog";
import { useGetStudentGroup } from "@/features/college/api/use-get-student-group";
import { useSubmitMilestone } from "@/features/college/api/use-submit-milestone";
import { resolveMilestoneStatus } from "@/features/college/utils";
import { cn } from "@/lib/utils";
import { Workspace } from "@/features/workspaces/types";
import { Task, TaskStatus } from "@/features/tasks/types";
import { StudentTaskSubmitDialog } from "@/features/college/components/student-task-submit-dialog";

interface CollegeStudentDashboardViewProps {
  workspace: Workspace;
}

export const CollegeStudentDashboardView: React.FC<CollegeStudentDashboardViewProps> = ({
  workspace,
}) => {
  const workspaceId = workspace.$id || workspace.id;
  const { open: openCreateTask } = useCreateTaskModal();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [submittingTask, setSubmittingTask] = useState<Task | null>(null);

  // Document submission state
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");

  const { data: studentGroup, isLoading, refetch } = useGetStudentGroup({ workspaceId });
  const { mutate: submitMilestone, isPending: isSubmitting } = useSubmitMilestone();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-36 rounded-2xl bg-muted" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-muted" />
          <div className="h-24 rounded-xl bg-muted" />
          <div className="h-24 rounded-xl bg-muted" />
          <div className="h-24 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!studentGroup || !studentGroup.team) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Users}
          title="Not Assigned to a Project Group"
          description="You haven't been added to an academic capstone group yet. Ask your Faculty Guide for your group's join code, or click below to enter a code."
          actionLabel="Enter Join Code"
          actionHref="/join"
        />
      </div>
    );
  }

  const {
    team,
    batch,
    isLead,
    guide,
    roster,
    tasks,
    upcomingMilestone,
    recentSubmissions,
    latestFeedback,
  } = studentGroup;

  const todoTasks = tasks.filter((t) => t.status === TaskStatus.TODO || t.status === TaskStatus.BACKLOG);
  const inProgressTasks = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS);
  const inReviewTasks = tasks.filter(
    (t) => t.verification_status === "PENDING_GUIDE_REVIEW" || t.status === TaskStatus.IN_REVIEW
  );
  const doneTasks = tasks.filter(
    (t) => t.status === TaskStatus.DONE || t.verification_status === "APPROVED"
  );

  const upcomingMilestoneSub = recentSubmissions.find(
    (s) => s.milestone_id === upcomingMilestone?.id
  );
  const milestoneStatus = resolveMilestoneStatus(upcomingMilestone, upcomingMilestoneSub);

  const handleSubmitDeliverable = () => {
    if (!upcomingMilestone || !submissionUrl.trim()) return;

    submitMilestone(
      {
        param: { milestoneId: upcomingMilestone.id },
        json: {
          teamId: team.id,
          fileUrl: submissionUrl.trim(),
          notes: submissionNotes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setSubmissionUrl("");
          setSubmissionNotes("");
          refetch();
        },
      }
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header & Team Roster Strip */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-transparent border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-primary text-primary-foreground">
                {team.team_code}
              </span>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {team.title}
              </h1>
              <Badge
                variant="secondary"
                className={`text-[10px] font-bold ${
                  isLead
                    ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/25"
                    : "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/25"
                }`}
              >
                {isLead ? "Team Lead" : "Student"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {batch ? `${batch.department} • ${batch.name}` : "Academic Capstone Project"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isLead && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsInviteModalOpen(true)}
                className="gap-1.5 text-xs h-9 font-medium"
              >
                <Users className="size-3.5" />
                Invite Teammate
              </Button>
            )}

            <Button size="sm" variant="secondary" className="gap-1.5 text-xs h-9" asChild>
              <Link href={`/workspaces/${workspaceId}/chat`}>
                <MessageSquare className="size-3.5" />
                Group Chat
              </Link>
            </Button>
          </div>
        </div>

        {/* Team Roster Strip */}
        <div className="mt-4 pt-3 border-t flex items-center justify-between gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
            <span className="font-semibold text-foreground">Roster ({roster.length}):</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {roster.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[11px] font-medium"
                >
                  <MemberAvatar name={m.name} className="size-4 text-[9px]" />
                  {m.name}
                  {m.isLead && <span className="text-[9px] text-amber-500 font-bold">(Lead)</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Split: Assigned Faculty Guide Card & Milestone Countdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Guide Info Card with Message Guide Button */}
        <div className="p-4 rounded-xl border bg-card shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <MemberAvatar name={guide.name} className="size-11 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Assigned Faculty Guide
              </p>
              <h3 className="text-sm font-bold text-foreground truncate">
                Prof. {guide.name}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Capstone Mentor & Evaluator
              </p>
            </div>
          </div>

          <Button size="sm" variant="outline" asChild className="gap-1.5 text-xs h-8 shrink-0">
            <Link href={guide?.id ? `/workspaces/${workspaceId}/chat?memberId=${guide.id}` : `/workspaces/${workspaceId}/chat`}>
              <MessageSquare className="size-3.5" />
              Message Guide
            </Link>
          </Button>
        </div>

        {/* Milestone Deadline Countdown */}
        <div className="p-4 rounded-xl border bg-card shadow-xs flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Calendar className="size-3 text-primary" />
              Upcoming Milestone Defense
            </p>
            <h3 className="text-sm font-bold text-foreground truncate">
              {upcomingMilestone ? upcomingMilestone.title : "No Defense Scheduled"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {upcomingMilestone?.due_date
                ? `Due: ${format(new Date(upcomingMilestone.due_date), "PP")}`
                : "Schedule will be posted by HOD"}
            </p>
          </div>

          {upcomingMilestone && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-bold px-2.5 py-1",
                milestoneStatus.variant === "success" &&
                  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
                milestoneStatus.variant === "warning" &&
                  "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25",
                milestoneStatus.variant === "destructive" &&
                  "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25",
                milestoneStatus.variant === "secondary" &&
                  "bg-muted text-muted-foreground border-border"
              )}
            >
              {milestoneStatus.status === "APPROVED" ? (
                <CheckCircle2 className="size-3 mr-1 text-emerald-600 dark:text-emerald-400" />
              ) : milestoneStatus.status === "OVERDUE" ? (
                <AlertCircle className="size-3 mr-1 text-rose-600 dark:text-rose-400" />
              ) : (
                <Clock className="size-3 mr-1" />
              )}
              {milestoneStatus.label}
            </Badge>
          )}
        </div>
      </div>

      {/* 3. Latest Guide Remarks Feed (if available) */}
      {latestFeedback && (
        <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-4 text-purple-600 dark:text-purple-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-200">
              Latest Remarks from Prof. {guide.name}
            </h4>
          </div>
          <p className="text-xs text-foreground italic bg-card p-3 rounded-lg border">
            &ldquo;{latestFeedback}&rdquo;
          </p>
        </div>
      )}

      {/* 4. Group Tasks Kanban Canvas */}
      <div className="bg-card border border-border rounded-xl p-5 text-card-foreground space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                Group Deliverables & Tasks
              </h2>
              <Badge variant="outline" className="text-[10px]">
                {tasks.length} Deliverables
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tasks submitted for faculty verification.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isLead && (
              <Button size="sm" onClick={openCreateTask} className="gap-1.5 text-xs h-8">
                <Plus className="size-3.5" />
                New Group Task
              </Button>
            )}
            {team.project_id && (
              <Button variant="outline" size="sm" className="text-xs h-8" asChild>
                <Link href={`/workspaces/${workspaceId}/projects/${team.project_id}`}>
                  Full Kanban Board →
                </Link>
              </Button>
            )}
          </div>
        </div>

        <DottedSeparator />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Column 1: Backlog / Todo */}
          <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground pb-1 border-b">
              <span>Todo</span>
              <Badge variant="secondary" className="text-[10px]">{todoTasks.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {todoTasks.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg border bg-card text-xs space-y-2 shadow-2xs">
                  <p className="font-semibold text-foreground line-clamp-2">{t.name}</p>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t text-[10px] text-muted-foreground">
                    <span>{t.assignee?.name || "Unassigned"}</span>
                    <button
                      type="button"
                      onClick={() => setSubmittingTask(t)}
                      className="text-primary hover:underline font-semibold flex items-center gap-1"
                    >
                      <Send className="size-2.5" />
                      Submit Work
                    </button>
                  </div>
                </div>
              ))}
              {todoTasks.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center py-6">No pending tasks</p>
              )}
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 pb-1 border-b">
              <span>In Progress</span>
              <Badge variant="secondary" className="text-[10px]">{inProgressTasks.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {inProgressTasks.map((t) => {
                const isChanges = t.verification_status === "CHANGES_REQUESTED" || t.review_status === "CHANGES_REQUESTED";
                return (
                  <div
                    key={t.id}
                    className={`p-2.5 rounded-lg border bg-card text-xs space-y-2 shadow-2xs border-l-2 ${
                      isChanges ? "border-l-amber-500 bg-amber-500/5" : "border-l-blue-500"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-semibold text-foreground line-clamp-2">{t.name}</p>
                      {isChanges && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 shrink-0">
                          Revision
                        </Badge>
                      )}
                    </div>
                    {isChanges && (t.reviewer_feedback || t.guide_feedback) && (
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 italic line-clamp-2 bg-background/80 p-1 rounded border border-amber-300 dark:border-amber-900/50">
                        &quot;{t.reviewer_feedback || t.guide_feedback}&quot;
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t text-[10px] text-muted-foreground">
                      <span>{t.assignee?.name || "Unassigned"}</span>
                      <button
                        type="button"
                        onClick={() => setSubmittingTask(t)}
                        className={`${
                          isChanges ? "text-amber-600 dark:text-amber-400 font-bold" : "text-blue-600 dark:text-blue-400 font-semibold"
                        } hover:underline flex items-center gap-1`}
                      >
                        <Send className="size-2.5" />
                        {isChanges ? "Revise & Resubmit" : "Submit Work"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {inProgressTasks.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center py-6">No tasks in progress</p>
              )}
            </div>
          </div>

          {/* Column 3: Ready for Guide Review */}
          <div className="rounded-xl border bg-amber-500/5 border-amber-500/20 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400 pb-1 border-b border-amber-500/20">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                Awaiting Verification
              </span>
              <Badge variant="secondary" className="text-[10px]">{inReviewTasks.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {inReviewTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSubmittingTask(t)}
                  className="p-2.5 rounded-lg border bg-card text-xs space-y-1 shadow-2xs border-l-2 border-l-amber-500 cursor-pointer hover:border-amber-400 transition"
                >
                  <p className="font-semibold text-foreground line-clamp-2">{t.name}</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    Awaiting Prof. {guide.name} verification
                  </p>
                  {t.submission_notes && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1 italic">
                      Notes: {t.submission_notes}
                    </p>
                  )}
                </div>
              ))}
              {inReviewTasks.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center py-6">No tasks in review</p>
              )}
            </div>
          </div>

          {/* Column 4: Verified & Completed */}
          <div className="rounded-xl border bg-emerald-500/5 border-emerald-500/20 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 pb-1 border-b border-emerald-500/20">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3" />
                Signed Off by Guide
              </span>
              <Badge variant="secondary" className="text-[10px]">{doneTasks.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {doneTasks.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg border bg-card text-xs space-y-1 shadow-2xs border-l-2 border-l-emerald-500">
                  <p className="font-semibold text-foreground line-clamp-2">{t.name}</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="size-2.5" />
                    Verified & Done
                  </p>
                </div>
              ))}
              {doneTasks.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center py-6">No signed-off tasks yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Document Submission Zone (Synopsis, PPT, Thesis) */}
      <div className="bg-card border border-border rounded-xl p-5 text-card-foreground space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground">
                Document Submission Zone (Synopsis, PPT, Code Zip)
              </h2>
              <p className="text-xs text-muted-foreground">
                Submit project deliverables for milestone defense and grading rubrics.
              </p>
            </div>
          </div>

          {upcomingMilestone && (
            <Badge variant="outline" className="text-xs font-semibold">
              Milestone: {upcomingMilestone.title}
            </Badge>
          )}
        </div>

        <DottedSeparator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Submission Form */}
          <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Submit Deliverable for {upcomingMilestone ? upcomingMilestone.title : "Current Milestone"}
            </h4>

            <div className="space-y-1.5">
              <Label htmlFor="doc-url" className="text-xs font-medium flex items-center gap-1">
                <LinkIcon className="size-3 text-muted-foreground" />
                Document URL (Google Drive / GitHub / Overleaf / PDF) *
              </Label>
              <Input
                id="doc-url"
                placeholder="https://drive.google.com/file/d/..."
                value={submissionUrl}
                onChange={(e) => setSubmissionUrl(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-notes" className="text-xs font-medium">
                Submission Remarks & Changes Note
              </Label>
              <Textarea
                id="doc-notes"
                rows={2}
                placeholder="e.g. Version 1.2 with updated circuit diagram and literature survey..."
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <Button
              size="sm"
              disabled={isSubmitting || !submissionUrl.trim() || !upcomingMilestone}
              onClick={handleSubmitDeliverable}
              className="w-full text-xs gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  Submit Document for Guide Review
                </>
              )}
            </Button>
          </div>

          {/* Submission History / Status */}
          <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Recent Submissions & Status
            </h4>

            {recentSubmissions && recentSubmissions.length > 0 ? (
              <div className="space-y-2">
                {recentSubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-2.5 rounded-lg border bg-card text-xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="font-semibold text-foreground">Version {sub.version}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {sub.submitted_at ? format(new Date(sub.submitted_at), "PPp") : "Submitted"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] font-bold ${
                          sub.status === "APPROVED"
                            ? "text-emerald-600 bg-emerald-500/10"
                            : sub.status === "CHANGES_REQUESTED"
                            ? "text-rose-600 bg-rose-500/10"
                            : "text-amber-600 bg-amber-500/10"
                        }`}
                      >
                        {sub.status}
                      </Badge>

                      {sub.file_url && (
                        <a
                          href={sub.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-[11px]"
                        >
                          View ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">
                No documents submitted yet for this milestone defense.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal for student teammate invites */}
      {isInviteModalOpen && (
        <InviteGroupStudentsDialog
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          workspaceId={workspaceId}
          teamId={team.id}
          teamCode={team.team_code}
          teamTitle={team.title}
          batchId={team.batch_id}
        />
      )}

      {/* Modal for student task deliverable submission */}
      <StudentTaskSubmitDialog
        task={submittingTask}
        isOpen={Boolean(submittingTask)}
        onClose={() => setSubmittingTask(null)}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
