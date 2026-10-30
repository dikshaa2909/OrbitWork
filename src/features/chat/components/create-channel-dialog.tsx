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
import { Loader2 } from "lucide-react";
import { useCreateChannel } from "../api/use-create-channel";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useGetTeams } from "@/features/teams/api/use-get-teams";
import { ChannelType } from "../types";

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export const CreateChannelDialog: React.FC<CreateChannelDialogProps> = ({
  open,
  onOpenChange,
  workspaceId,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ChannelType>("PRIVATE");
  const [projectId, setProjectId] = useState<string>("NONE");
  const [teamId, setTeamId] = useState<string>("NONE");

  const { data: projectsData } = useGetProjects({ workspaceId });
  const { data: teams = [] } = useGetTeams({ workspaceId });

  const { mutate: createChannel, isPending } = useCreateChannel();

  const handleCreate = () => {
    if (!name.trim()) return;

    createChannel(
      {
        json: {
          workspaceId,
          type,
          name: name.trim().toLowerCase().replace(/\s+/g, "-"),
          description: description.trim() || undefined,
          projectId: projectId !== "NONE" ? projectId : null,
          teamId: teamId !== "NONE" ? teamId : null,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setName("");
          setDescription("");
          setType("PRIVATE");
          setProjectId("NONE");
          setTeamId("NONE");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Chat Channel</DialogTitle>
          <DialogDescription>
            Create a topic-based channel for your team, project, or workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="channel-name">Channel Name *</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-semibold">
                #
              </span>
              <Input
                id="channel-name"
                placeholder="announcements, sprint-planning, general"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Channel Scope / Type</Label>
            <Select value={type} onValueChange={(val) => setType(val as ChannelType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WORKSPACE">
                  Workspace (Public to all members)
                </SelectItem>
                <SelectItem value="PROJECT">Project-scoped</SelectItem>
                <SelectItem value="TEAM">Team / Squad</SelectItem>
                <SelectItem value="PRIVATE">Private (Invite only)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "PROJECT" && (
            <div className="space-y-1.5">
              <Label>Link to Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Select a project</SelectItem>
                  {(projectsData?.documents || []).map((p) => {
                    const pId = (p.$id || p.id) as string;
                    return (
                      <SelectItem key={pId} value={pId}>
                        {p.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "TEAM" && (
            <div className="space-y-1.5">
              <Label>Link to Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Select a team</SelectItem>
                  {teams.map((t) => {
                    const tId = (t.$id || t.id) as string;
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

          <div className="space-y-1.5">
            <Label htmlFor="channel-desc">Topic / Description</Label>
            <Textarea
              id="channel-desc"
              rows={2}
              placeholder="What this channel is for..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
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
            {isPending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Channel"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

