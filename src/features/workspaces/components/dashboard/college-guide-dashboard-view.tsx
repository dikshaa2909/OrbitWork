"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  GraduationCap,
  Users,
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  ArrowRight,
  Copy,
  Check,
  Crown,
  KeyRound,
  ShieldAlert,
  KanbanSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DottedSeparator } from "@/components/dotted-separator";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/features/college/components/stat-card";
import { StudentRosterList } from "@/features/college/components/student-roster-list";
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

import { CreateGroupModal } from "@/features/college/components/create-group-modal";
import { InviteGroupStudentsDialog } from "@/features/college/components/invite-group-students-dialog";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useGetGuideDashboard } from "@/features/college/api/use-get-guide-dashboard";
import { useGetPendingTasks } from "@/features/college/api/use-get-pending-tasks";
import { useGetGuideSubmissions } from "@/features/college/api/use-get-guide-submissions";
import { useVerifyTask } from "@/features/college/api/use-verify-task";
import { useUpdateTeamMemberRole } from "@/features/college/api/use-update-team-member-role";
import { useRemoveTeamMember } from "@/features/college/api/use-remove-team-member";
import { Workspace } from "@/features/workspaces/types";
import { AcademicTeam, GuideTaskVerificationItem } from "@/features/college/types";
import { FacultyGroupProgressBoard } from "@/features/college/components/faculty-group-progress-board";

interface CollegeGuideDashboardViewProps {
  workspace: Workspace;
}

export const CollegeGuideDashboardView: React.FC<CollegeGuideDashboardViewProps> = ({
  workspace,
}) => {
  const workspaceId = workspace.$id || workspace.id;

  // Modals state
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [selectedTeamForInvite, setSelectedTeamForInvite] = useState<AcademicTeam | null>(null);
  const [activeTaskForChanges, setActiveTaskForChanges] = useState<GuideTaskVerificationItem | null>(null);
  const [changesFeedback, setChangesFeedback] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Remove confirmation state
  const [memberToRemove, setMemberToRemove] = useState<{
    teamId: string;
    memberId: string;
    studentName: string;
  } | null>(null);

  // Group Progress Board Inspection State
  const [selectedTeamIdForBoard, setSelectedTeamIdForBoard] = useState<string | null>(null);

  // Queries & Mutations
  const { data: currentMember } = useCurrentMember({ workspaceId });
  const { data: dashboardData, isLoading } = useGetGuideDashboard({ workspaceId });
  const { data: pendingTasks = [] } = useGetPendingTasks({ workspaceId });
  const { data: guideSubmissions = [] } = useGetGuideSubmissions({ workspaceId });

  const pendingMilestonesCount = guideSubmissions.filter((s) => s.status === "SUBMITTED").length;

  const { mutate: verifyTask, isPending: isVerifying } = useVerifyTask();
  const { mutate: updateRole } = useUpdateTeamMemberRole();
  const { mutate: removeMember, isPending: isRemovingMember } = useRemoveTeamMember();

  const groups = dashboardData?.groups || [];
  const batches = dashboardData?.batches || [];
  const totalStudents = dashboardData?.totalStudents || 0;
  const activeGroup = groups.find((g) => g.id === selectedTeamIdForBoard) || null;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success("Student join code copied!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSetTeamLead = (teamId: string, memberId: string) => {
    updateRole({
      param: { teamId, memberId },
      json: { role: "LEAD" },
    });
  };

  const handleDemoteLead = (teamId: string, memberId: string) => {
    updateRole({
      param: { teamId, memberId },
      json: { role: "MEMBER" },
    });
  };

  const handleConfirmRemove = () => {
    if (!memberToRemove) return;
    removeMember(
      {
        param: {
          teamId: memberToRemove.teamId,
          memberId: memberToRemove.memberId,
        },
      },
      {
        onSuccess: () => {
          setMemberToRemove(null);
        },
      }
    );
  };

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
      {/* ── Modal: Create Group Modal (Faculty Self-Service) ── */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        workspaceId={workspaceId}
        batches={batches}
      />

      {/* ── Modal: Invite Group Students Dialog ── */}
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

      {/* ── Modal: Confirm Remove Student ── */}
      {memberToRemove && (
        <Dialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="size-5" />
                <DialogTitle className="text-base font-bold">
                  Remove Student from Group
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs pt-1">
                Are you sure you want to remove <strong>{memberToRemove.studentName}</strong> from this project group? Their group tasks and chat permissions will be revoked.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMemberToRemove(null)}
                disabled={isRemovingMember}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmRemove}
                disabled={isRemovingMember}
                className="font-semibold"
              >
                {isRemovingMember ? "Removing..." : "Remove Student"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Modal: Send Remarks for Changes ── */}
      {activeTaskForChanges && (
        <Dialog open={!!activeTaskForChanges} onOpenChange={() => setActiveTaskForChanges(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-amber-500" />
                <DialogTitle className="text-base font-bold">
                  Request Task Changes
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs">
                Provide feedback for <strong>{activeTaskForChanges.name}</strong>. The student will be notified to revise and re-submit.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 pt-2">
              <Label className="text-xs font-semibold">Faculty Guide Remarks / Guidance</Label>
              <Textarea
                value={changesFeedback}
                onChange={(e) => setChangesFeedback(e.target.value)}
                placeholder="e.g. Please update the API sequence diagram and re-run calibration benchmarks before sign-off..."
                rows={4}
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTaskForChanges(null)}
                disabled={isVerifying}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSendRemarks}
                disabled={isVerifying || !changesFeedback.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                {isVerifying ? "Sending..." : "Send Remarks"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {activeGroup ? (
        <FacultyGroupProgressBoard
          workspaceId={workspaceId}
          group={activeGroup}
          onBack={() => setSelectedTeamIdForBoard(null)}
          onVerifyTask={(taskId) => {
            verifyTask({
              param: { taskId },
              json: { decision: "APPROVED" },
            });
          }}
          onRequestChanges={(task) => {
            setActiveTaskForChanges({
              id: task.$id || task.id,
              name: task.name,
              status: task.status,
              verification_status: "PENDING_GUIDE_REVIEW",
              team_id: activeGroup.id,
              team_title: activeGroup.title,
              team_code: activeGroup.team_code,
              assignee_name: task.assignee?.name || "Student",
              submission_notes: task.submission_notes || null,
              submission_file_url: task.submission_file_url || null,
              due_date: task.dueDate || new Date().toISOString(),
            });
          }}
          isVerifying={isVerifying}
        />
      ) : (
        <>
          {/* ── 1. Top Banner: Faculty Guide Profile & Primary "Create Project Group" Action ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-transparent border border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <GraduationCap className="size-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {currentMember?.name
                ? `Welcome, Prof. ${currentMember.name.replace(/^Prof\.?\s*/i, "")}`
                : "Faculty Portal — My Assigned Groups"}
            </h1>
            <Badge variant="secondary" className="text-[10px] font-bold">
              FACULTY GUIDE
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Supervise student teams and verify deliverables.
          </p>
        </div>

        {/* Primary Faculty Action: Exactly One Primary CTA */}
        {groups.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsCreateGroupOpen(true)}
              className="gap-1.5 shadow-md bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold h-9 px-4"
            >
              <Plus className="size-4" />
              Create Project Group
            </Button>
          </div>
        )}
      </div>

      {/* ── 2. Guide Key Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="My Groups"
          value={`${groups.length} Groups`}
          subValue="Active project supervision"
          icon={GraduationCap}
          iconClassName="bg-purple-500/10 text-purple-600 dark:text-purple-400"
        />
        <StatCard
          label="Tasks Waiting for Review"
          value={`${pendingTasks.length} Tasks`}
          subValue="Student submissions in review"
          icon={Clock}
          iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
        <StatCard
          label="Reports Pending Sign-Off"
          value={`${pendingMilestonesCount} Reports`}
          subValue="Milestone deliverables"
          icon={CheckCircle2}
          iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
      </div>

      {/* ── 3. Guided Groups Roster, Student Join Codes & Student Management ── */}
      <div className="bg-card border border-border rounded-xl p-5 text-card-foreground space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground">
              My Groups & Student Teams ({groups.length} Groups • {totalStudents} Students)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage student group rosters, assign team leads, and share group join codes.
            </p>
          </div>
        </div>

        <DottedSeparator />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-44 rounded-xl bg-muted animate-pulse" />
            <div className="h-44 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No project groups created yet"
            description="Click below to create your first project group and generate a student invite code."
            actionLabel="+ Create Project Group"
            onAction={() => setIsCreateGroupOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {groups.map((group) => {
              const leadStudent = group.roster.find((m) =>
                group.lead_member_id ? m.memberId === group.lead_member_id : m.role === "LEAD"
              );

              return (
                <Card
                  key={group.id}
                  className="shadow-xs border rounded-2xl overflow-hidden hover:border-primary/50 transition-all flex flex-col justify-between"
                >
                  <CardContent className="p-5 space-y-4">
                    {/* Header: Team Code & Title */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-extrabold text-xs px-2.5 py-1 rounded-md bg-purple-600 text-white">
                            {group.team_code}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {group.batch_name}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-foreground mt-1.5 leading-snug">
                          {group.title}
                        </h3>
                      </div>

                      {/* Join Code Badge with One-Click Copy */}
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                          Student Join Code
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(group.student_join_code)}
                          title="Click to copy join code"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary font-mono text-xs font-black tracking-wider transition-colors"
                        >
                          <KeyRound className="size-3.5" />
                          <span>{group.student_join_code}</span>
                          {copiedCode === group.student_join_code ? (
                            <Check className="size-3 text-emerald-500 ml-1" />
                          ) : (
                            <Copy className="size-3 opacity-60 ml-1" />
                          )}
                        </button>
                      </div>
                    </div>

                    {group.abstract && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {group.abstract}
                      </p>
                    )}

                    {/* Student Roster & Promotion Section */}
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Users className="size-3.5 text-muted-foreground" />
                          Student Roster ({group.roster.length}):
                        </span>
                        {leadStudent && (
                          <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                            <Crown className="size-3" />
                            Lead: {leadStudent.name}
                          </span>
                        )}
                      </div>

                      <StudentRosterList
                        teamId={group.id}
                        members={group.roster.map((r) => ({
                          id: r.id,
                          team_id: group.id,
                          member_id: r.memberId,
                          name: r.name,
                          email: r.email,
                          role: group.lead_member_id
                            ? r.memberId === group.lead_member_id
                              ? "LEAD"
                              : "MEMBER"
                            : r.role === "LEAD"
                            ? "LEAD"
                            : "MEMBER",
                          joined_at: new Date().toISOString(),
                        }))}
                        canManage={true}
                        onToggleLead={(tId, mId, currentRole) => {
                          if (currentRole === "LEAD") {
                            handleDemoteLead(tId, mId);
                          } else {
                            handleSetTeamLead(tId, mId);
                          }
                        }}
                        onRemoveStudent={(tId, mId) => {
                          const s = group.roster.find((mem) => mem.memberId === mId);
                          setMemberToRemove({
                            teamId: tId,
                            memberId: mId,
                            studentName: s?.name || "Student",
                          });
                        }}
                        emptyMessage={`No students enrolled yet. Share code ${group.student_join_code} with your students to self-join.`}
                      />
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="pt-3 border-t space-y-2">
                      <Button
                        size="sm"
                        onClick={() => setSelectedTeamIdForBoard(group.id)}
                        className="w-full text-xs h-8.5 gap-1.5 font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                      >
                        <KanbanSquare className="size-3.5" />
                        Open Group Workspace / Progress Board
                      </Button>

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedTeamForInvite({
                              id: group.id,
                              team_code: group.team_code,
                              title: group.title,
                              batch_id: group.batch_id,
                            } as AcademicTeam)
                          }
                          className="text-xs h-8 gap-1.5"
                        >
                          <Plus className="size-3.5" />
                          Invite Students
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs h-8 gap-1.5 font-medium"
                          asChild
                        >
                          <Link
                            href={
                              group.channel_id
                                ? `/workspaces/${workspaceId}/chat?channelId=${group.channel_id}`
                                : `/workspaces/${workspaceId}/chat`
                            }
                          >
                            <MessageSquare className="size-3.5" />
                            Open Group Chat
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 4. Task Verification Action Queue ── */}
      <div className="bg-card border border-border rounded-xl p-5 text-card-foreground space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Verification Queue ({pendingTasks.length} Deliverables in Review)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tasks moved to Review by your student groups awaiting faculty sign-off into Done.
            </p>
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/workspaces/${workspaceId}/college?tab=verify`}>
              Open Full Queue
              <ArrowRight className="size-3.5 ml-1.5" />
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
                className="p-3.5 rounded-xl border bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {task.team_code}
                    </span>
                    <h4 className="font-semibold text-sm text-foreground">
                      {task.name}
                    </h4>
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                      In Review
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Project Group: <strong>{task.team_title || "Academic Project"}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActiveTaskForChanges(task);
                      setChangesFeedback("");
                    }}
                    disabled={isVerifying}
                    className="h-8 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                  >
                    Send Remarks
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleApprove(task.id)}
                    disabled={isVerifying}
                    className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
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
      </>
    )}
    </div>
  );
};
