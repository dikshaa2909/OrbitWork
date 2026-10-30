"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  GraduationCap,
  Copy,
  Check,
  ShieldCheck,
  Loader2,
  Calendar,
  Building,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DottedSeparator } from "@/components/dotted-separator";
import { useCreateInviteLink } from "@/features/invite-links/api/use-create-invite-link";

interface InviteFacultyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  departmentName?: string;
  batchId?: string;
}

export const InviteFacultyDialog: React.FC<InviteFacultyDialogProps> = ({
  isOpen,
  onClose,
  workspaceId,
  departmentName,
  batchId,
}) => {
  const [expiryOption, setExpiryOption] = useState<string>("180"); // 6 months / semester
  const [deptTag, setDeptTag] = useState<string>(departmentName || "");
  const [copied, setCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const { mutate: createLink, isPending } = useCreateInviteLink();

  const handleGenerate = () => {
    // Generate clean academic code prefix: e.g. FAC-XXXXXX
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const cleanDept = (deptTag || "ENG").replace(/[^A-Za-z0-9]/g, "").substring(0, 3).toUpperCase();
    const suggestedCode = `FAC-${cleanDept}-${randomSuffix}`;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiryOption, 10));

    createLink(
      {
        workspaceId,
        target_role: "FACULTY_GUIDE",
        batch_id: batchId,
        label: `Faculty Guide Access Code - ${deptTag || "Department"}`,
        expiresAt: expiresAt.toISOString(),
        maxUses: 50,
      },
      {
        onSuccess: (res) => {
          const code = res?.data?.code || suggestedCode;
          setGeneratedCode(code);
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
            <div className="size-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Invite Faculty Members
              </DialogTitle>
              <DialogDescription className="text-xs">
                Generate a Faculty Access Code for teachers and project guides in this department.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DottedSeparator className="my-2" />

        {generatedCode ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl border bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900 text-center space-y-2">
              <p className="text-xs font-semibold uppercase text-purple-700 dark:text-purple-300 tracking-wider">
                Faculty Access Code
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-mono font-extrabold tracking-widest text-purple-900 dark:text-purple-100">
                  {generatedCode}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handleCopy(generatedCode)}
                  className="size-8"
                  title="Copy Access Code"
                >
                  {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                </Button>
              </div>
              <Badge variant="secondary" className="text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200">
                Bound to: Faculty Project Guide Role
              </Badge>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Direct Faculty Join Link</Label>
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
                Teachers can click this link or enter the code on the college portal to join as verified guides.
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Building className="size-3.5 text-muted-foreground" />
                Department / Program Tag
              </Label>
              <Input
                value={deptTag}
                onChange={(e) => setDeptTag(e.target.value)}
                placeholder="e.g. Computer Engineering"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Calendar className="size-3.5 text-muted-foreground" />
                Access Code Validity
              </Label>
              <Select value={expiryOption} onValueChange={setExpiryOption}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select validity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">1 Month (30 Days)</SelectItem>
                  <SelectItem value="180">Current Semester (6 Months)</SelectItem>
                  <SelectItem value="365">Full Academic Year (12 Months)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 rounded-xl border bg-muted/40 flex items-start gap-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <p>
                Teachers joining with this code are granted Faculty Guide permissions: reviewing group tasks, grading milestone rubrics, and issuing student invite codes.
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
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Generating...
                  </>
                ) : (
                  "Generate Faculty Access Code"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

