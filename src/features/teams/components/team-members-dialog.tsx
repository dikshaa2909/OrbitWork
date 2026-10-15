"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Trash2, Crown, Users, RefreshCw } from "lucide-react";
import { Team } from "../types";
import { useGetTeamMembers, useAddTeamMember, useRemoveTeamMember } from "../api/use-team-members";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { MemberAvatar } from "@/features/members/components/member-avatar";

interface TeamMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
  workspaceId: string;
}

export const TeamMembersDialog: React.FC<TeamMembersDialogProps> = ({
  open,
  onOpenChange,
  team,
  workspaceId,
}) => {
  const teamId = team ? (team.id || (team.$id as string)) : "";
  const { data: teamMembers = [], isLoading } = useGetTeamMembers(teamId);
  const { data: workspaceMembersData } = useGetMembers({ workspaceId });
  const allWorkspaceMembers = workspaceMembersData?.documents || [];

  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState<string>("NONE");

  const { mutate: addMember, isPending: isAdding } = useAddTeamMember();
  const { mutate: removeMember, isPending: isRemoving } = useRemoveTeamMember();

  if (!team) return null;

  const currentMemberIds = new Set(teamMembers.map((m) => (m.id || m.$id) as string));
  const availableToAdd = allWorkspaceMembers.filter(
    (m) => !currentMemberIds.has((m.id || m.$id) as string)
  );

  const handleAdd = () => {
    if (selectedMemberToAdd === "NONE") return;
    addMember(
      { teamId, memberId: selectedMemberToAdd },
      {
        onSuccess: () => setSelectedMemberToAdd("NONE"),
      }
    );
  };

  const handleRemove = (memberId: string) => {
    removeMember({ teamId, memberId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5 text-indigo-600" />
            {team.name} &bull; Team Roster
          </DialogTitle>
          <DialogDescription>
            Manage team members and view assigned squad contributors.
          </DialogDescription>
        </DialogHeader>

        {/* Add Member Bar */}
        <div className="flex items-center gap-2 pt-2">
          <Select value={selectedMemberToAdd} onValueChange={setSelectedMemberToAdd}>
            <SelectTrigger className="flex-1 text-xs">
              <SelectValue placeholder="Add workspace member to team..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">Select a member to add</SelectItem>
              {availableToAdd.map((m) => {
                const mId = (m.id || m.$id) as string;
                return (
                  <SelectItem key={mId} value={mId}>
                    {m.name || m.email} ({m.role})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={selectedMemberToAdd === "NONE" || isAdding}
            className="text-xs gap-1 font-semibold"
          >
            <UserPlus className="size-3.5" />
            {isAdding ? "Adding..." : "Add"}
          </Button>
        </div>

        {/* Member List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60 mt-3 border rounded-lg">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="size-4 animate-spin text-primary" />
              Loading team roster...
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No members in this team yet. Use the dropdown above to add members.
            </div>
          ) : (
            teamMembers.map((m) => {
              const mId = (m.id || m.$id) as string;
              const isLead = team.leadMemberId === mId;

              return (
                <div
                  key={mId}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MemberAvatar name={m.name || m.email || "M"} className="size-8 text-xs" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs sm:text-sm truncate text-neutral-900 dark:text-neutral-100">
                          {m.name || m.email}
                        </span>
                        {isLead && (
                          <Badge variant="default" className="text-[10px] gap-1 bg-amber-500 hover:bg-amber-600 text-white">
                            <Crown className="size-3" />
                            Lead
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {m.email} &bull; <span className="uppercase">{m.role}</span>
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemove(mId)}
                    disabled={isRemoving}
                    className="text-muted-foreground hover:text-destructive h-8 px-2"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
