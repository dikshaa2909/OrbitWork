"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  GraduationCap,
  Plus,
  Crown,
  UserPlus,
  MessageSquare,
  MoreVertical,
  UserMinus,
  Users,
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
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

import { useAssignGuide } from "../api/use-assign-guide";
import { useUpdateTeamMemberRole } from "../api/use-update-team-member-role";
import { useRemoveTeamMember } from "../api/use-remove-team-member";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { usePermissions } from "@/hooks/use-permissions";
import { MemberRole } from "@/features/members/types";
import { useCollegePersona } from "../hooks/use-college-persona";
import { AcademicTeam, Batch } from "../types";

import { CreateGroupModal } from "./create-group-modal";
import { InviteGroupStudentsDialog } from "./invite-group-students-dialog";

interface TeamsTabProps {
  batch: Batch;
  batches?: Batch[];
  teams: AcademicTeam[];
  isLoading: boolean;
  workspaceId: string;
  canManage: boolean;
  canAssignGuide: boolean;
}

export const TeamsTab: React.FC<TeamsTabProps> = ({
  batch,
  batches = [batch],
  teams,
  isLoading,
  workspaceId,
  canManage,
  canAssignGuide,
}) => {
  const { role, memberId, can } = usePermissions(workspaceId);
  const { data: currentMember } = useCurrentMember({ workspaceId });

  const { isHod: isHodPersona, isGuide: isGuidePersona } = useCollegePersona(workspaceId);

  // Determine hierarchy persona
  const isHod =
    isHodPersona ||
    role === MemberRole.ADMIN ||
    role === MemberRole.OWNER ||
    can("college:batches.manage") ||
    canManage;

  const isFacultyGuide =
    isGuidePersona ||
    role === MemberRole.PROJECT_MANAGER ||
    can("college:teams.create") ||
    can("college:tasks.verify") ||
    Boolean(currentMember?.roleName?.toLowerCase().includes("guide")) ||
    Boolean(currentMember?.roleName?.toLowerCase().includes("faculty")) ||
    Boolean(currentMember?.roleName?.toLowerCase().includes("project manager"));

  // Both Faculty and HOD can create groups! Students cannot.
  const canCreateGroup = isHod || isFacultyGuide;

  // Filter teams: Faculty only sees groups mentored by them; HOD sees all
  const displayedTeams = React.useMemo(() => {
    if (isHod) return teams;
    if (isFacultyGuide) {
      return teams.filter((t) =>
        t.guides?.some(
          (g) =>
            g.guide_member_id === memberId ||
            (g.email && memberId && g.name?.includes(memberId))
        )
      );
    }
    return teams;
  }, [teams, isHod, isFacultyGuide, memberId]);

  // Dialog states
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [assignGuideTeam, setAssignGuideTeam] = useState<AcademicTeam | null>(null);
  const [selectedGuideId, setSelectedGuideId] = useState("");

  // Student Invite Modal state
  const [studentInviteTeam, setStudentInviteTeam] = useState<{
    id: string;
    teamCode: string;
    title: string;
  } | null>(null);

  const { data: membersData } = useGetMembers({ workspaceId });
  const members = membersData?.documents || [];

  const { mutate: assignGuide, isPending: isAssigningGuide } = useAssignGuide();
  const { mutate: updateRole } = useUpdateTeamMemberRole();
  const { mutate: removeMember, isPending: isRemovingMember } = useRemoveTeamMember();

  const handleAssignGuide = () => {
    if (!assignGuideTeam || !selectedGuideId) return;

    assignGuide(
      {
        param: { teamId: assignGuideTeam.id },
        json: { guideMemberId: selectedGuideId },
      },
      {
        onSuccess: () => {
          setAssignGuideTeam(null);
          setSelectedGuideId("");
        },
      }
    );
  };

  const handleToggleLead = (teamId: string, memberIdToPromote: string, currentRole: "LEAD" | "MEMBER") => {
    const newRole = currentRole === "LEAD" ? "MEMBER" : "LEAD";
    updateRole(
      {
        param: { teamId, memberId: memberIdToPromote },
        json: { role: newRole },
      },
      {
        onSuccess: () => {
          toast.success(
            newRole === "LEAD"
              ? "Student promoted to Team Lead! They can now organize group tasks."
              : "Demoted to Team Member"
          );
        },
      }
    );
  };

  const handleRemoveStudent = (teamId: string, studentMemberId: string) => {
    if (!confirm("Are you sure you want to remove this student from the project group?")) return;
    removeMember(
      {
        param: { teamId, memberId: studentMemberId },
      },
      {
        onSuccess: () => {
          toast.success("Student removed from team");
        },
      }
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card/60">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-foreground">
              {isHod
                ? `Academic Project Teams (${displayedTeams.length})`
                : `My Guided Project Teams (${displayedTeams.length})`}
            </h3>
            <Badge variant="outline" className="text-[10px] font-semibold">
              {isHod ? "DEPARTMENT OVERSIGHT" : "FACULTY GUIDE PORTAL"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            {isHod
              ? "All capstone project groups registered in this cohort across all faculty guides. Faculty mentors create their groups, add students via join codes, and designate student leads."
              : "Project groups mentored by you. Create project groups, share student join codes with your students, promote student leads, and sign off on submitted tasks."}
          </p>
        </div>

        {canCreateGroup && (
          <Button
            size="sm"
            onClick={() => setIsCreateGroupOpen(true)}
            className="gap-1.5 shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="size-4" />
            Register Project Group
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex justify-between">
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
              <div className="h-5 w-3/4 bg-muted rounded" />
              <div className="h-3 w-full bg-muted/60 rounded" />
              <div className="h-12 w-full bg-muted/40 rounded mt-4" />
            </div>
          ))}
        </div>
      ) : displayedTeams.length === 0 ? (
        <div className="py-12 border border-dashed rounded-xl text-center space-y-3 bg-muted/10">
          <FolderKanban className="size-10 mx-auto text-muted-foreground stroke-1" />
          <p className="font-semibold text-sm text-foreground">
            {isHod
              ? "No project teams registered in this batch yet"
              : "You have not registered any project groups yet"}
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {isHod
              ? `Faculty guides can create their own groups for ${batch.name}, or you can register a group right now.`
              : `Create your project group for ${batch.name}. You will be automatically assigned as the faculty guide and receive a Student Join Code to share with your students.`}
          </p>
          {canCreateGroup && (
            <Button
              size="sm"
              onClick={() => setIsCreateGroupOpen(true)}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-medium"
            >
              <Plus className="size-4" />
              Create Project Group
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedTeams.map((t) => {
            const hasGuide = Boolean(t.guides && t.guides.length > 0);
            const guideName = hasGuide ? t.guides![0].name : "Not Assigned";
            const isMyTeam =
              t.guides?.some((g) => g.guide_member_id === memberId) || isHod;

            const roster = t.members || [];
            const lead = roster.find((m) => m.role === "LEAD");

            return (
              <div
                key={t.id}
                className="p-5 rounded-2xl border bg-card hover:border-primary/40 transition-all flex flex-col justify-between shadow-xs space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Bar: Code & Guide Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="font-mono text-xs font-bold px-2 py-0.5 bg-primary/5 text-primary border-primary/20">
                        {t.team_code}
                      </Badge>
                    </div>

                    {hasGuide ? (
                      <Badge variant="secondary" className="text-[11px] font-medium gap-1">
                        <GraduationCap className="size-3.5 text-indigo-500" />
                        {guideName}
                      </Badge>
                    ) : (
                      canAssignGuide && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setAssignGuideTeam(t)}
                          className="text-[10px] text-amber-600 hover:text-amber-700 h-6 px-1.5"
                        >
                          + Assign Guide
                        </Button>
                      )
                    )}
                  </div>

                  {/* Title & Abstract */}
                  <div>
                    <h4 className="font-bold text-sm text-foreground line-clamp-2 leading-snug">
                      {t.title}
                    </h4>
                    {t.abstract && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {t.abstract}
                      </p>
                    )}
                  </div>

                  {/* Student Team Lead Section */}
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        Team Lead:
                      </span>
                      {lead ? (
                        <span className="font-semibold text-foreground flex items-center gap-1 text-xs">
                          <Crown className="size-3.5 text-amber-500 fill-amber-500/20" />
                          {lead.name || lead.email}
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-500 italic font-medium">
                          No Lead Assigned
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Student Roster Section */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                        <Users className="size-3" />
                        Enrolled Students ({roster.length}):
                      </span>
                    </div>

                    {roster.length === 0 ? (
                      <div className="py-2 px-3 rounded-lg border border-dashed text-center bg-muted/20">
                        <p className="text-[11px] text-muted-foreground">
                          No students joined yet. Share invite code to enroll members.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {roster.map((student) => {
                          const isStudentLead = student.role === "LEAD";
                          const studentMemberId = student.member_id;

                          return (
                            <div
                              key={student.id}
                              className="flex items-center justify-between p-1.5 rounded-md bg-muted/30 border border-border/40 text-xs"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div className="size-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {student.name ? student.name[0].toUpperCase() : "S"}
                                </div>
                                <div className="truncate">
                                  <p className="text-xs font-medium text-foreground truncate">
                                    {student.name || student.email}
                                  </p>
                                  {isStudentLead && (
                                    <span className="text-[9px] font-bold text-amber-600 flex items-center gap-0.5">
                                      <Crown className="size-2.5" /> Team Lead
                                    </span>
                                  )}
                                </div>
                              </div>

                              {isMyTeam && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-6 text-muted-foreground"
                                    >
                                      <MoreVertical className="size-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="text-xs">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleToggleLead(t.id, studentMemberId, student.role)
                                      }
                                      className="gap-2 cursor-pointer font-medium"
                                    >
                                      <Crown className="size-3.5 text-amber-500" />
                                      {isStudentLead
                                        ? "Demote to Member"
                                        : "Promote to Team Lead"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleRemoveStudent(t.id, studentMemberId)}
                                      disabled={isRemovingMember}
                                      className="gap-2 text-destructive cursor-pointer"
                                    >
                                      <UserMinus className="size-3.5" />
                                      Remove from Group
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Action Buttons */}
                <div className="pt-3 border-t flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-8 gap-1.5"
                    onClick={() =>
                      setStudentInviteTeam({
                        id: t.id,
                        teamCode: t.team_code,
                        title: t.title,
                      })
                    }
                  >
                    <UserPlus className="size-3.5 text-primary" />
                    Invite Students
                  </Button>

                  <Button size="sm" variant="outline" className="h-8 px-2.5" asChild title="Team Chat">
                    <Link href={`/workspaces/${workspaceId}/chat`}>
                      <MessageSquare className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Group Creation Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        workspaceId={workspaceId}
        batches={batches}
        defaultBatchId={batch.id}
      />

      {/* Invite Students to Specific Group Modal */}
      {studentInviteTeam && (
        <InviteGroupStudentsDialog
          isOpen={Boolean(studentInviteTeam)}
          onClose={() => setStudentInviteTeam(null)}
          workspaceId={workspaceId}
          teamId={studentInviteTeam.id}
          teamCode={studentInviteTeam.teamCode}
          teamTitle={studentInviteTeam.title}
          batchId={batch.id}
        />
      )}

      {/* Assign Guide Dialog (for HOD / Department Admin) */}
      <Dialog
        open={Boolean(assignGuideTeam)}
        onOpenChange={(open) => !open && setAssignGuideTeam(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Faculty Guide</DialogTitle>
            <DialogDescription>
              Assign a professor or faculty guide to supervise {assignGuideTeam?.team_code}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label>Select Faculty Guide</Label>
            <select
              value={selectedGuideId}
              onChange={(e) => setSelectedGuideId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
            >
              <option value="">Choose a faculty mentor</option>
              {members.map((m) => {
                const mId = (m.userId || m.$id || m.id) as string;
                return (
                  <option key={mId} value={mId}>
                    {m.name || m.email} ({m.roleName || m.role})
                  </option>
                );
              })}
            </select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignGuideTeam(null)}
              disabled={isAssigningGuide}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAssignGuide}
              disabled={!selectedGuideId || isAssigningGuide}
              className="bg-primary text-primary-foreground"
            >
              {isAssigningGuide ? "Assigning..." : "Assign Guide"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
