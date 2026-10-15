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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTeam } from "../api/use-create-team";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { Team } from "../types";

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  existingTeams?: Team[];
}

export const CreateTeamDialog: React.FC<CreateTeamDialogProps> = ({
  open,
  onOpenChange,
  workspaceId,
  existingTeams = [],
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leadMemberId, setLeadMemberId] = useState<string>("NONE");
  const [parentTeamId, setParentTeamId] = useState<string>("NONE");

  const { data: membersData } = useGetMembers({ workspaceId });
  const members = membersData?.documents || [];

  const { mutate: createTeam, isPending } = useCreateTeam();

  const handleCreate = () => {
    if (!name.trim()) return;

    createTeam(
      {
        json: {
          workspaceId,
          name: name.trim(),
          description: description.trim() || undefined,
          leadMemberId: leadMemberId !== "NONE" ? leadMemberId : null,
          parentTeamId: parentTeamId !== "NONE" ? parentTeamId : null,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setName("");
          setDescription("");
          setLeadMemberId("NONE");
          setParentTeamId("NONE");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
          <DialogDescription>
            Organize members into functional squads, departments, or project teams.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Team Name *</Label>
            <Input
              id="team-name"
              placeholder="e.g. Frontend Squad, Design System, Platform"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team-desc">Description</Label>
            <Textarea
              id="team-desc"
              rows={2}
              placeholder="What this team handles..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Team Lead (optional)</Label>
            <Select value={leadMemberId} onValueChange={setLeadMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team lead" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">No Lead Assigned</SelectItem>
                {members.map((m) => {
                  const mId = (m.id || m.$id) as string;
                  return (
                    <SelectItem key={mId} value={mId}>
                      {m.name || m.email} ({m.role})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {existingTeams.length > 0 && (
            <div className="space-y-1.5">
              <Label>Parent Team (optional department)</Label>
              <Select value={parentTeamId} onValueChange={setParentTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select parent team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Top-level Team (No Parent)</SelectItem>
                  {existingTeams.map((t) => {
                    const tId = (t.id || t.$id) as string;
                    return (
                      <SelectItem key={tId} value={tId}>
                        {t.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
            onClick={handleCreate}
            disabled={!name.trim() || isPending}
          >
            {isPending ? "Creating..." : "Create Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
