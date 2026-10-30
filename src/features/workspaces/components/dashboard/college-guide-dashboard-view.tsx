"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Users,
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  ArrowRight,
  ExternalLink,
  FileCheck2,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DottedSeparator } from "@/components/dotted-separator";
import { EmptyState } from "@/components/empty-state";
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
import { InviteGroupStudentsDialog } from "@/features/college/components/invite-group-students-dialog";

import { useGetGuideGroups } from "@/features/college/api/use-get-guide-groups";
import { useGetPendingTasks } from "@/features/college/api/use-get-pending-tasks";
import { useVerifyTask } from "@/features/college/api/use-verify-task";
import { Workspace } from "@/features/workspaces/types";
import { AcademicTeam, GuideTaskVerificationItem } from "@/features/college/types";

interface CollegeGuideDashboardViewProps {
  workspace: Workspace;
}

export const CollegeGuideDashboardView: React.FC<CollegeGuideDashboardViewProps> = ({
  workspace,
}) => {
  const workspaceId = workspace.$id || workspace.id;

  const [selectedTeamForInvite, setSelectedTeamForInvite] = useState<AcademicTeam | null>(null);
  const [activeTaskForChanges, setActiveTaskForChanges] = useState<GuideTaskVerificationItem | null>(null);
  const [changesFeedback, setChangesFeedback] = useState("");

  const { data: groups = [] } = useGetGuideGroups({
    workspaceId,
  });

  const { data: pendingTasks = [] } = useGetPendingTasks({
    workspaceId,
  });

  const { mutate: verifyTask, isPending: isVerifying } = useVerifyTask();

  const handleApprove = (taskId: string) => {
    verifyTask({
      param: { taskId },
      json: {
        decision: "APPROVED",
        feedback: "Deliverable verified and signed off by Faculty Guide.",
      },
    });
  };

  const handleSendRemarks = () => {
    if (!activeTaskForChanges) return;

    verifyTask(
      {
        param: { taskId: activeTaskForChanges.id },
        json: {
          decision: "CHANGES_REQUESTED",
          feedback: changesFeedback.trim() || "Changes requested. Please update and re-submit.",
        },
      },
      {
        onSuccess: () => {
          setActiveTaskForChanges(null);
          setChangesFeedback("");
        },
      }
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner: Faculty Guide Profile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-900/10 via-teal-900/10 to-transparent border border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <GraduationCap className="size-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Faculty Portal — My Assigned Groups
            </h1>
            <Badge variant="secondary" className="text-[10px] font-bold">
              FACULTY PROJECT GUIDE
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Supervise capstone groups, verify student milestone deliverables, and issue group join codes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" asChild className="gap-1.5 shadow-sm bg-primary text-primary-foreground">
            <Link href={`/workspaces/${workspaceId}/college?tab=teams`}>
              <Plus className="size-4" />
              + Create New Project Group
            </Link>
          </Button>

          <Button size="sm" variant="outline" asChild>
            <Link href={`/workspaces/${workspaceId}/college?tab=verify`}>
              Verification Queue ({pendingTasks.length})
              <ArrowRight className="size-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Guide Personal Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* My Groups */}
        <div className="p-4 rounded-xl border bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              My Groups
            </p>
            <p className="text-2xl font-extrabold text-foreground mt-1">
              {groups.length} Groups
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Assigned for supervision
            </p>
          </div>
          <div className="size-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Users className="size-5" />
          </div>
        </div>

        {/* Tasks Awaiting Review */}
        <div className="p-4 rounded-xl border bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Tasks Awaiting Review
            </p>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
              {pendingTasks.length} Tasks
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Action required from guide
            </p>
          </div>
          <div className="size-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="size-5" />
          </div>
        </div>

        {/* Reports Pending Sign-Off */}
        <div className="p-4 rounded-xl border bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Reports Pending Sign-Off
            </p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              Active
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Milestone rubrics ready
            </p>
          </div>
          <div className="size-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <FileCheck2 className="size-5" />
          </div>
        </div>
      </div>

      {/* Guided Groups Roster & Join Code Generation */}
      <div className="bg-card border border-border rounded-xl p-5 text-card-foreground space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">
              My Groups ({groups.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate group-scoped student join codes so students land directly in their assigned teams.
            </p>
          </div>
        </div>

        <DottedSeparator />

        {groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No project groups assigned yet"
            description="Your Department Head (HOD) will allocate student capstone groups to you for mentorship."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((team) => (
              <Card key={team.id} className="shadow-none border rounded-xl overflow-hidden hover:border-primary/40 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-muted">
                        {team.team_code}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground mt-1 line-clamp-1">
                        {team.title}
                      </h4>
                    </div>
                    {team.project_id && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                        <Link href={`/workspaces/${workspaceId}/projects/${team.project_id}`}>
                          Review Tasks →
                        </Link>
                      </Button>
                    )}
                  </div>

                  {team.abstract && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {team.abstract}
                    </p>
                  )}

                  <div className="pt-2 border-t flex items-center justify-between gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedTeamForInvite(team)}
                      className="text-xs h-8 gap-1.5"
                    >
                      <Plus className="size-3.5" />
                      Generate Student Invite Code
                    </Button>

                    <Button size="sm" variant="secondary" className="text-xs h-8 gap-1.5" asChild>
                      <Link href={`/workspaces/${workspaceId}/chat`}>
                        <MessageSquare className="size-3.5" />
                        Open Group Chat
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Task Verification Action Queue */}
      <div className="bg-card border border-border rounded-xl p-5 text-card-foreground space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Verification Queue ({pendingTasks.length} Deliverables in Review)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tasks moved to Review by your students awaiting faculty sign-off into Done.
            </p>
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/workspaces/${workspaceId}/college?tab=verify`}>
              Open Full Queue
              <ExternalLink className="size-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>

        <DottedSeparator />

        {pendingTasks.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All deliverables verified!"
            description="There are currently no tasks waiting for your faculty sign-off."
          />
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                className="p-3.5 rounded-lg border bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-muted">
                      {task.team_code}
                    </span>
                    <h4 className="text-sm font-semibold text-foreground">
                      {task.name}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Group: {task.team_title} • Submitted by: {task.assignee_name || "Student Member"}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isVerifying}
                    onClick={() => setActiveTaskForChanges(task)}
                    className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                  >
                    Send Remarks for Changes
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={isVerifying}
                    onClick={() => handleApprove(task.id)}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Sign Off & Mark Done
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for student team join code */}
      {selectedTeamForInvite && (
        <InviteGroupStudentsDialog
          isOpen={!!selectedTeamForInvite}
          onClose={() => setSelectedTeamForInvite(null)}
          workspaceId={workspaceId}
          teamId={selectedTeamForInvite.id}
          teamCode={selectedTeamForInvite.team_code}
          teamTitle={selectedTeamForInvite.title}
          batchId={selectedTeamForInvite.batch_id}
        />
      )}

      {/* Remarks Dialog */}
      <Dialog
        open={!!activeTaskForChanges}
        onOpenChange={(open) => {
          if (!open) {
            setActiveTaskForChanges(null);
            setChangesFeedback("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="size-5 text-destructive" />
              <DialogTitle className="text-base font-bold">
                Send Remarks for Changes
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Provide constructive feedback for {activeTaskForChanges?.name}. The task will return to In Progress for the students to revise.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="guide-remarks" className="text-xs font-medium">
              Faculty Remarks / Feedback *
            </Label>
            <Textarea
              id="guide-remarks"
              rows={4}
              value={changesFeedback}
              onChange={(e) => setChangesFeedback(e.target.value)}
              placeholder="Specify required corrections (e.g. Include circuit diagram in Section 3 and update test results)..."
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTaskForChanges(null);
                setChangesFeedback("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isVerifying || !changesFeedback.trim()}
              onClick={handleSendRemarks}
            >
              Send Remarks to Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
