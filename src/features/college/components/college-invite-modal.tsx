"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  GraduationCap,
  Users,
  Copy,
  Check,
  ShieldAlert,
  Loader2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DottedSeparator } from "@/components/dotted-separator";
import { useCreateInviteLink } from "@/features/invite-links/api/use-create-invite-link";

interface CollegeInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  type: "FACULTY" | "STUDENT";
  teamId?: string;
  teamCode?: string;
  teamTitle?: string;
  batchId?: string;
}

export const CollegeInviteModal: React.FC<CollegeInviteModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  type,
  teamId,
  teamCode,
  teamTitle,
  batchId,
}) => {
  const [maxUses, setMaxUses] = useState<string>("50");
  const [copied, setCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const { mutate: createLink, isPending } = useCreateInviteLink();

  const handleGenerate = () => {
    createLink(
      {
        workspaceId,
        target_role: type === "FACULTY" ? "FACULTY_GUIDE" : "STUDENT",
        academic_team_id: type === "STUDENT" ? teamId : undefined,
        batch_id: batchId,
        label:
          type === "FACULTY"
            ? "Faculty Guide Join Code"
            : `Student Join Code for ${teamCode || "Team"}`,
        maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
      },
      {
        onSuccess: (res) => {
          const code = res?.data?.code;
          if (code) {
            setGeneratedCode(code);
          }
        },
      }
    );
  };

  const joinUrl = generatedCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/workspaces/${workspaceId}/join/${generatedCode}`
    : "";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleModalClose = () => {
    setGeneratedCode(null);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              {type === "FACULTY" ? (
                <GraduationCap className="size-5" />
              ) : (
                <Users className="size-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {type === "FACULTY"
                  ? "Generate Faculty Guide Join Code"
                  : `Generate Student Join Code`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {type === "FACULTY"
                  ? "Distribute this code to department faculty mentors."
                  : `Students joining with this code are automatically placed in ${teamCode ? `${teamCode} - ${teamTitle}` : "this group"}.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DottedSeparator className="my-2" />

        {generatedCode ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl border bg-muted/30 text-center space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Shareable Join Code
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-mono font-extrabold tracking-widest text-primary">
                  {generatedCode}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handleCopy(generatedCode)}
                  className="size-8"
                  title="Copy Code"
                >
                  {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                </Button>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                Bound to: {type === "FACULTY" ? "Faculty Guide Role" : `${teamCode} Group Roster`}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Direct Join URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={joinUrl}
                  className="text-xs font-mono bg-muted/40 h-9"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopy(joinUrl)}
                  className="h-9 shrink-0 gap-1 text-xs"
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy Link
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={handleModalClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="maxUses" className="text-xs font-medium">
                Maximum Uses (Students / Faculty limit)
              </Label>
              <Input
                id="maxUses"
                type="number"
                min="1"
                max="500"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="50"
                className="text-xs h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                {type === "FACULTY"
                  ? "Estimated number of department guides who will join."
                  : "Standard capstone groups typically have 3-5 students."}
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-muted/40 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="size-4 text-primary shrink-0 mt-0.5" />
              <p>
                {type === "FACULTY"
                  ? "Faculty guides receive Project Manager level privileges and access to assigned student groups."
                  : "Students receive Member permissions scoped to this project group and cannot view other groups' private deliverables."}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleModalClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleGenerate} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Generating...
                  </>
                ) : (
                  "Generate Code"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
