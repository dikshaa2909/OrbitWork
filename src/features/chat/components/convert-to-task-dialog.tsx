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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckSquare } from "lucide-react";
import { useConvertToTask } from "../api/use-convert-to-task";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { Message } from "../types";

interface ConvertToTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: Message | null;
  workspaceId: string;
}

export const ConvertToTaskDialog: React.FC<ConvertToTaskDialogProps> = ({
  open,
  onOpenChange,
  message,
  workspaceId,
}) => {
  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState<string>("");

  const { data: projectsData } = useGetProjects({ workspaceId });
  const projects = projectsData?.documents || [];

  const { mutate: convertToTask, isPending } = useConvertToTask();

  const handleConvert = () => {
    if (!message || !projectId) return;

    convertToTask(
      {
        param: { messageId: message.id },
        json: {
          projectId,
          title: title.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setTitle("");
          setProjectId("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="size-5 text-indigo-600" />
            Convert Message to Task
          </DialogTitle>
          <DialogDescription>
            Create an actionable task directly from this team discussion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Task Title</Label>
            <Input
              id="task-title"
              placeholder="e.g. Investigate production latency"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Target Project *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => {
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

          {message && (
            <div className="rounded-md border p-3 bg-muted/40 text-xs text-muted-foreground max-h-32 overflow-y-auto">
              <span className="font-semibold block mb-1">Message content:</span>
              <div
                dangerouslySetInnerHTML={{
                  __html: message.body.slice(0, 300),
                }}
              />
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
            onClick={handleConvert}
            disabled={!projectId || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              "Create Task"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

