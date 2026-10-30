"use client";

import React, { useState } from "react";
import { FolderKanban, GraduationCap, Plus } from "lucide-react";
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

import { useCreateAcademicTeam } from "../api/use-create-academic-team";
import { useAssignGuide } from "../api/use-assign-guide";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { AcademicTeam, Batch } from "../types";

interface TeamsTabProps {
  batch: Batch;
  teams: AcademicTeam[];
  isLoading: boolean;
  workspaceId: string;
  canManage: boolean;
  canAssignGuide: boolean;
}

export const TeamsTab: React.FC<TeamsTabProps> = ({
  batch,
  teams,
  isLoading,
  workspaceId,
  canManage,
  canAssignGuide,
}) => {
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [assignGuideTeam, setAssignGuideTeam] = useState<AcademicTeam | null>(null);
  const [selectedGuideId, setSelectedGuideId] = useState("");

  const { data: membersData } = useGetMembers({ workspaceId });
  const members = membersData?.documents || [];

  // Create team state
  const [teamCode, setTeamCode] = useState("");
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [leadMemberId, setLeadMemberId] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const { mutate: createTeam, isPending: isCreatingTeam } = useCreateAcademicTeam();
  const { mutate: assignGuide, isPending: isAssigningGuide } = useAssignGuide();

  const handleCreateTeam = () => {
    if (!teamCode.trim() || !title.trim() || !leadMemberId) return;

    createTeam(
      {
        param: { batchId: batch.id },
        json: {
          batchId: batch.id,
          teamCode: teamCode.trim().toUpperCase(),
          title: title.trim(),
          abstract: abstract.trim() || undefined,
          leadMemberId,
          memberIds: selectedMemberIds,
        },
      },
      {
        onSuccess: () => {
          setCreateTeamOpen(false);
          setTeamCode("");
          setTitle("");
          setAbstract("");
          setLeadMemberId("");
          setSelectedMemberIds([]);
        },
      }
    );
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-foreground">
            Academic Project Teams
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Student groups, project titles, team leads, and assigned faculty guides.
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => setCreateTeamOpen(true)}
            className="gap-1.5"
          >
            <Plus className="size-3.5" />
            Register Team
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex justify-between">
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
              <div className="h-5 w-3/4 bg-muted rounded" />
              <div className="h-3 w-full bg-muted/60 rounded" />
              <div className="h-8 w-full bg-muted/40 rounded mt-4" />
            </div>
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="py-12 border border-dashed rounded-lg text-center space-y-3">
          <FolderKanban className="size-8 mx-auto text-muted-foreground" />
          <p className="font-semibold text-sm text-foreground">
            No student teams registered
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Register project groups for {batch.name} to track capstone and major engineering projects.
          </p>
          {canManage && (
            <Button
              size="sm"
              onClick={() => setCreateTeamOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              Register First Team
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => (
            <div
              key={t.id}
              className="p-4 rounded-xl border bg-card hover:shadow-sm transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {t.team_code}
                  </Badge>
                  {Boolean(t.guides && t.guides.length > 0) ? (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <GraduationCap className="size-3 text-indigo-500" />
                      {t.guides![0].name}
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

                <div>
                  <h4 className="font-bold text-sm text-foreground line-clamp-2">
                    {t.title}
                  </h4>
                  {t.abstract && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                      {t.abstract}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Lead:</span>
                    <span className="font-medium text-foreground">
                      {t.lead_name}
                    </span>
                  </div>

                  {Boolean(t.members && t.members.length > 0) && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Roster ({t.members!.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {t.members!.map((m) => (
                          <span
                            key={m.id}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground"
                          >
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Team Dialog */}
      <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Academic Team</DialogTitle>
            <DialogDescription>
              Create a project group, designate a student lead, and assign teammates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-code">Team Code *</Label>
                <Input
                  id="t-code"
                  placeholder="e.g. GRP-01, B4-CS"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Team Lead *</Label>
                <select
                  value={leadMemberId}
                  onChange={(e) => setLeadMemberId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs"
                >
                  <option value="">Select student lead</option>
                  {members.map((m) => {
                    const mId = (m.userId || m.$id || m.id) as string;
                    return (
                      <option key={mId} value={mId}>
                        {m.name || m.email}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-title">Project Title *</Label>
              <Input
                id="t-title"
                placeholder="Autonomous Drone Navigation System..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-abs">Abstract / Summary</Label>
              <Textarea
                id="t-abs"
                rows={2}
                placeholder="High level overview of what the team is developing..."
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateTeamOpen(false)}
              disabled={isCreatingTeam}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateTeam}
              disabled={!teamCode.trim() || !title.trim() || !leadMemberId || isCreatingTeam}
            >
              {isCreatingTeam ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                "Register Team"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Guide Dialog */}
      <Dialog
        open={Boolean(assignGuideTeam)}
        onOpenChange={(open) => !open && setAssignGuideTeam(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Faculty Guide</DialogTitle>
            <DialogDescription>
              Assign an instructor or professor to supervise {assignGuideTeam?.team_code}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label>Select Faculty Guide</Label>
            <select
              value={selectedGuideId}
              onChange={(e) => setSelectedGuideId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs"
            >
              <option value="">Choose a member / faculty</option>
              {members.map((m) => {
                const mId = (m.userId || m.$id || m.id) as string;
                return (
                  <option key={mId} value={mId}>
                    {m.name || m.email} ({m.role})
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
            >
              {isAssigningGuide ? "Assigning..." : "Assign Guide"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
