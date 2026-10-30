"use client";

import React, { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Users,
  GraduationCap,
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  Upload,
  FileText,
  Loader2,
  Link as LinkIcon,
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
import { Workspace } from "@/features/workspaces/types";
import { TaskStatus } from "@/features/tasks/types";

interface CollegeStudentDashboardViewProps {
  workspace: Workspace;
}

export const CollegeStudentDashboardView: React.FC<CollegeStudentDashboardViewProps> = ({
  workspace,
}) => {
  const workspaceId = workspace.$id || workspace.id;
  const { open: openCreateTask } = useCreateTaskModal();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

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
      {/* 1. Header & Sub-header Banner */}
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
              {isLead && (
                <Badge variant="secondary" className="text-[10px] font-bold">
                  STUDENT TEAM LEAD
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Faculty Guide: <strong className="text-foreground">Prof. {guide.name}</strong> • Status: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isLead && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsInviteModalOpen(true)}
                className="gap-1.5 text-xs h-9"
              >
                <Plus className="size-3.5" />
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
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Group Members ({roster.length}):</span>
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

          {batch && (
            <span className="text-[11px] text-muted-foreground">
              {batch.department} • {batch.name}
            </span>
          )}
        </div>
      </div>

      {/* 2. Stat Cards: Tasks Breakdown & Milestone Countdown */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border bg-card text-center space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Todo Tasks
          </p>
          <p className="text-2xl font-extrabold text-foreground">{todoTasks.length}</p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card text-center space-y-1">
          <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">
            In Progress
          </p>
          <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {inProgressTasks.length}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card text-center space-y-1">
          <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
            Awaiting Sign-off
          </p>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {inReviewTasks.length}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card text-center space-y-1">
          <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
            Guide Verified
          </p>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {doneTasks.length}
          </p>
        </div>

        <div className="col-span-2 md:col-span-1 p-3.5 rounded-xl border bg-card space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Upcoming Deadline
          </p>
          <p className="text-xs font-bold text-foreground truncate">
            {upcomingMilestone ? upcomingMilestone.title : "No Defense Set"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {upcomingMilestone?.due_date
              ? format(new Date(upcomingMilestone.due_date), "PP")
              : "TBA"}
          </p>
        </div>
      </div>

      {/* 3. Latest Guide Remarks Feed (if any feedback available) */}
      {latestFeedback && (
        <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-4 text-purple-600 dark:text-purple-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-200">
              Latest Guide Feedback from Prof. {guide.name}
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
                Group Tasks Kanban Board
              </h2>
              <Badge variant="outline" className="text-[10px]">
                {tasks.length} Deliverables
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Move tasks to Ready for Guide Review when complete. Only Faculty Guides can sign off into Completed.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isLead && (
              <Button size="sm" onClick={openCreateTask} className="gap-1 text-xs h-8">
                <Plus className="size-3.5" />
                + New Task
              </Button>
            )}
            {team.project_id && (
              <Button variant="outline" size="sm" className="text-xs h-8" asChild>
                <Link href={`/workspaces/${workspaceId}/projects/${team.project_id}`}>
                  Full Kanban →
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
              <span>Backlog / Todo</span>
              <Badge variant="secondary" className="text-[10px]">{todoTasks.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {todoTasks.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg border bg-card text-xs space-y-1 shadow-2xs">
                  <p className="font-semibold text-foreground line-clamp-1">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.assignee?.name || "Unassigned"}</p>
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
              {inProgressTasks.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg border bg-card text-xs space-y-1 shadow-2xs border-l-2 border-l-blue-500">
                  <p className="font-semibold text-foreground line-clamp-1">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.assignee?.name || "Unassigned"}</p>
                </div>
              ))}
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
                Ready for Guide Review
              </span>
              <Badge variant="secondary" className="text-[10px]">{inReviewTasks.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {inReviewTasks.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg border bg-card text-xs space-y-1 shadow-2xs border-l-2 border-l-amber-500">
                  <p className="font-semibold text-foreground line-clamp-1">{t.name}</p>
                  <p className="text-[10px] text-amber-600 font-medium">Awaiting Prof. {guide.name} sign-off</p>
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
                Verified & Completed
              </span>
              <Badge variant="secondary" className="text-[10px]">{doneTasks.length}</Badge>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {doneTasks.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg border bg-card text-xs space-y-1 shadow-2xs border-l-2 border-l-emerald-500">
                  <p className="font-semibold text-foreground line-clamp-1 line-through opacity-80">{t.name}</p>
                  <p className="text-[10px] text-emerald-600 font-medium">Guide Verified</p>
                </div>
              ))}
              {doneTasks.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center py-6">No verified tasks yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Document Submission Upload Zone (Synopsis, PPT, Final Thesis) */}
      <div className="bg-card border border-border rounded-xl p-5 text-card-foreground space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground">
                Document Submission Zone (Synopsis, PPT, Thesis)
              </h2>
              <p className="text-xs text-muted-foreground">
                Submit project deliverables for evaluation and defense grading.
              </p>
            </div>
          </div>

          {upcomingMilestone && (
            <Badge variant="outline" className="text-xs">
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
    </div>
  );
};
