"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  GraduationCap,
  Copy,
  Check,
  Loader2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

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
import { DottedSeparator } from "@/components/dotted-separator";
import { useCreateAcademicTeam } from "../api/use-create-academic-team";
import { Batch } from "../types";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  batches: Batch[];
  defaultBatchId?: string;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  batches,
  defaultBatchId,
}) => {
  const [selectedBatchId, setSelectedBatchId] = useState<string>(
    defaultBatchId || batches[0]?.id || ""
  );

  React.useEffect(() => {
    if (defaultBatchId) {
      setSelectedBatchId(defaultBatchId);
    } else if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [defaultBatchId, batches, selectedBatchId]);
  const [teamCode, setTeamCode] = useState("");
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");

  // Success view state
  const [createdGroup, setCreatedGroup] = useState<{
    id: string;
    teamCode: string;
    title: string;
    studentJoinCode: string;
    channelId?: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const { mutate: createTeam, isPending } = useCreateAcademicTeam();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const batchId = selectedBatchId || batches[0]?.id;
    if (!batchId) {
      toast.error("Please select an academic batch cohort");
      return;
    }

    if (!teamCode.trim() || !title.trim()) {
      toast.error("Group code and project title are required");
      return;
    }

    createTeam(
      {
        param: { batchId },
        json: {
          batchId,
          teamCode: teamCode.trim().toUpperCase(),
          title: title.trim(),
          abstract: abstract.trim() || undefined,
        },
      },
      {
        onSuccess: (res) => {
          const resData = (res as unknown as { data?: { id?: string; student_join_code?: string; channel_id?: string } })?.data;
          setCreatedGroup({
            id: resData?.id || "",
            teamCode: teamCode.trim().toUpperCase(),
            title: title.trim(),
            studentJoinCode: resData?.student_join_code || `${teamCode.trim().toUpperCase()}-JOIN`,
            channelId: resData?.channel_id,
          });
        },
      }
    );
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Student join code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleModalClose = () => {
    setCreatedGroup(null);
    setTeamCode("");
    setTitle("");
    setAbstract("");
    setCopied(false);
    onClose();
  };

  const joinUrl = createdGroup
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${createdGroup.studentJoinCode}`
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="max-w-md">
        {!createdGroup ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <GraduationCap className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">
                    Create Project Group
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Register a new student capstone group. You will be automatically assigned as the Guide.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <DottedSeparator />

            {/* Batch Selection */}
            {batches.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">
                  Academic Batch Cohort
                </Label>
                <Select
                  value={selectedBatchId || batches[0]?.id}
                  onValueChange={setSelectedBatchId}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-10 text-xs font-medium">
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="text-xs">
                        {b.name} ({b.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Group Code / Number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">
                Group Number / Code
              </Label>
              <Input
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                placeholder="e.g. GRP-04 or GROUP 04"
                className="font-mono text-sm uppercase h-10 font-bold"
                disabled={isPending}
                required
                autoFocus
              />
            </div>

            {/* Project Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">
                Project Title
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Autonomous Agricultural Drone Navigation"
                className="h-10 text-sm font-medium"
                disabled={isPending}
                required
              />
            </div>

            {/* Abstract / Domain */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">
                Abstract / Domain Tags (Optional)
              </Label>
              <Textarea
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                placeholder="Brief summary of project objectives, tech stack, or problem statement..."
                className="text-xs resize-none"
                rows={3}
                disabled={isPending}
              />
            </div>

            {/* Info Callout */}
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-700 dark:text-purple-300 flex items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-purple-500" />
              <span>
                A dedicated private chat channel and student join code will be auto-generated instantly.
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleModalClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending || !teamCode.trim() || !title.trim()}
                className="gap-1.5 font-semibold"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create & Generate Code
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* Success Screen: Instant Student Join Code */
          <div className="space-y-4 animate-fade-in">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Check className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">
                    Group Registered Successfully!
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Share this join code with your student group members.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <DottedSeparator />

            <div className="p-4 rounded-xl bg-muted/60 border space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Project Group
                </p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  <span className="font-mono text-purple-600 dark:text-purple-400">
                    {createdGroup.teamCode}
                  </span>{" "}
                  — {createdGroup.title}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Student Join Code
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 p-2.5 rounded-lg bg-background border font-mono text-lg font-black tracking-widest text-primary text-center">
                    {createdGroup.studentJoinCode}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleCopyCode(createdGroup.studentJoinCode)}
                    className="h-11 px-4 gap-1.5 font-semibold"
                  >
                    {copied ? (
                      <>
                        <Check className="size-4 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" />
                        Copy Code
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Direct Join Link
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    value={joinUrl}
                    readOnly
                    className="text-xs font-mono h-9 bg-background"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyCode(joinUrl)}
                    className="h-9 px-3"
                  >
                    Copy Link
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Students who enter this code at <strong>/join</strong> will automatically be enrolled into{" "}
              <strong>{createdGroup.teamCode}</strong> and added to your private team discussion chat.
            </p>

            <DialogFooter className="pt-2 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handleModalClose}
                className="w-full sm:w-auto"
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
