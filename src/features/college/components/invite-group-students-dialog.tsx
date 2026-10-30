"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Copy,
  Check,
  ShieldAlert,
  Loader2,
  Crown,
  UserCheck,
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

interface InviteGroupStudentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  teamId: string;
  teamCode: string;
  teamTitle: string;
  batchId?: string;
}

export const InviteGroupStudentsDialog: React.FC<InviteGroupStudentsDialogProps> = ({
  isOpen,
  onClose,
  workspaceId,
  teamId,
  teamCode,
  teamTitle,
  batchId,
}) => {
  const [selectedRole, setSelectedRole] = useState<"STUDENT" | "STUDENT_LEAD">("STUDENT");
  const [copied, setCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const { mutate: createLink, isPending } = useCreateInviteLink();

  const handleGenerate = () => {
    createLink(
      {
        workspaceId,
        target_role: selectedRole,
        academic_team_id: teamId,
        batch_id: batchId,
        label: `${teamCode} ${selectedRole === "STUDENT_LEAD" ? "Team Lead" : "Student"} Join Code`,
        maxUses: selectedRole === "STUDENT_LEAD" ? 1 : 10,
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
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${generatedCode}`
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
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Student Join Code
              </DialogTitle>
              <DialogDescription className="text-xs">
                Invite students to <strong className="text-foreground">{teamCode} — {teamTitle}</strong>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DottedSeparator className="my-2" />

        {generatedCode ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 text-center space-y-2">
              <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300 tracking-wider">
                Group Join Code
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-mono font-extrabold tracking-widest text-blue-900 dark:text-blue-100">
                  {generatedCode}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handleCopy(generatedCode)}
                  className="size-8"
                  title="Copy Group Code"
                >
                  {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                </Button>
              </div>
              <Badge variant="secondary" className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                Bound to: {teamCode} ({selectedRole === "STUDENT_LEAD" ? "Team Lead" : "Group Member"})
              </Badge>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Direct Group Join Link</Label>
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
              <p className="text-[11px] text-muted-foreground">
                Students who enter this code or click the link will automatically be enrolled into {teamCode}&apos;s team roster and group chat.
              </p>
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
              <Label className="text-xs font-medium">Assign Joining Role in {teamCode}</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Member Option */}
                <div
                  onClick={() => setSelectedRole("STUDENT")}
                  className={`cursor-pointer rounded-xl border p-3 transition-all flex flex-col justify-between ${
                    selectedRole === "STUDENT"
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-1 ring-blue-600"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <UserCheck className="size-4 text-blue-600" />
                    {selectedRole === "STUDENT" && <Check className="size-3.5 text-blue-600" />}
                  </div>
                  <div className="mt-2">
                    <p className="font-semibold text-xs text-foreground">Student Member</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                      Standard teammate for this capstone group.
                    </p>
                  </div>
                </div>

                {/* Lead Option */}
                <div
                  onClick={() => setSelectedRole("STUDENT_LEAD")}
                  className={`cursor-pointer rounded-xl border p-3 transition-all flex flex-col justify-between ${
                    selectedRole === "STUDENT_LEAD"
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-1 ring-blue-600"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Crown className="size-4 text-amber-500" />
                    {selectedRole === "STUDENT_LEAD" && <Check className="size-3.5 text-blue-600" />}
                  </div>
                  <div className="mt-2">
                    <p className="font-semibold text-xs text-foreground">Student Team Lead</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                      Can create tasks and submit milestone reports.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl border bg-muted/40 flex items-start gap-2.5 text-xs text-muted-foreground">
              <ShieldAlert className="size-4 text-blue-600 shrink-0 mt-0.5" />
              <p>
                Students joining with this code are isolated to this project group. They cannot access other groups&apos; private work.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleModalClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Generating...
                  </>
                ) : (
                  "Generate Group Join Code"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

