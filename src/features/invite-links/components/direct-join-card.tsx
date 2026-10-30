"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Users,
  ArrowRight,
  Loader2,
  AlertCircle,
  Building,
  KeyRound,
  CheckCircle2,
  ClipboardPaste,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DottedSeparator } from "@/components/dotted-separator";
import { useLookupInviteLink } from "../api/use-lookup-invite-link";
import { useJoinInviteLink } from "../api/use-join-invite-link";

interface DirectJoinCardProps {
  initialCode?: string;
}

export const DirectJoinCard: React.FC<DirectJoinCardProps> = ({
  initialCode = "",
}) => {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [submittedCode, setSubmittedCode] = useState(initialCode.trim().toUpperCase());
  const [alreadyMemberWorkspaceId, setAlreadyMemberWorkspaceId] = useState<string | null>(null);

  // Sync initialCode if changed
  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      setSubmittedCode(initialCode.trim().toUpperCase());
    }
  }, [initialCode]);

  const normalizedCode = submittedCode.trim().toUpperCase();

  const {
    data: inviteInfo,
    isLoading: isLookingUp,
    error: lookupError,
    isError: isLookupError,
  } = useLookupInviteLink({
    code: normalizedCode,
  });

  const { mutate: joinWorkspace, isPending: isJoining } = useJoinInviteLink();

  const handleLookup = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmittedCode(code.trim().toUpperCase());
    setAlreadyMemberWorkspaceId(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // Extract code if a full URL was pasted
        const match = text.match(/\/join\/([A-Za-z0-9_-]+)/);
        const extracted = match ? match[1] : text.trim();
        setCode(extracted);
        setSubmittedCode(extracted.trim().toUpperCase());
      }
    } catch {
      // Clipboard read failed or denied
    }
  };

  const handleConfirmJoin = () => {
    if (!normalizedCode) return;

    joinWorkspace(
      { code: normalizedCode },
      {
        onSuccess: (res) => {
          const workspaceId =
            res?.data?.workspaceId || inviteInfo?.workspaceId;
          if (workspaceId) {
            router.push(`/workspaces/${workspaceId}`);
          }
        },
        onError: (err) => {
          if (
            err.message?.toLowerCase().includes("already a member") &&
            inviteInfo?.workspaceId
          ) {
            setAlreadyMemberWorkspaceId(inviteInfo.workspaceId);
          }
        },
      }
    );
  };

  const isFaculty = inviteInfo?.targetRole === "FACULTY_GUIDE";
  const isStudentGroup =
    inviteInfo?.targetRole === "STUDENT_LEAD" ||
    inviteInfo?.targetRole === "STUDENT" ||
    !!inviteInfo?.academicTeamId;

  return (
    <Card className="w-full max-w-xl mx-auto shadow-lg border border-border/60 bg-card">
      <CardHeader className="text-center p-6 pb-4 space-y-2">
        <div className="mx-auto size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
          {isFaculty ? (
            <GraduationCap className="size-7" />
          ) : isStudentGroup ? (
            <Users className="size-7" />
          ) : (
            <KeyRound className="size-7" />
          )}
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Join Academic Workspace
        </CardTitle>
        <CardDescription className="text-sm max-w-md mx-auto">
          Enter your Faculty or Student Join Code provided by your Department Coordinator or Project Guide.
        </CardDescription>
      </CardHeader>

      <div className="px-6">
        <DottedSeparator className="my-2" />
      </div>

      <CardContent className="p-6 space-y-6">
        {/* Code Input Form */}
        <form onSubmit={handleLookup} className="space-y-3">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Access Code
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. FAC-ENG-842 or GRP04-STUDENT"
                className="font-mono text-base font-semibold tracking-wider h-11 pr-10 uppercase"
                disabled={isJoining}
                autoFocus={!initialCode}
              />
              <button
                type="button"
                onClick={handlePaste}
                title="Paste from clipboard"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
              >
                <ClipboardPaste className="size-4" />
              </button>
            </div>
            <Button
              type="submit"
              disabled={!code.trim() || isLookingUp || isJoining}
              className="h-11 px-5 font-semibold"
            >
              {isLookingUp ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Verify"
              )}
            </Button>
          </div>
        </form>

        {/* Verification Loader */}
        {isLookingUp && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground animate-pulse">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span>Looking up invitation details...</span>
          </div>
        )}

        {/* Error / Not Found Alert */}
        {isLookupError && normalizedCode && !isLookingUp && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 flex items-start gap-3 text-sm animate-fade-in">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Invalid or Expired Code</p>
              <p className="text-xs opacity-90">
                {lookupError?.message ||
                  "The access code you entered is invalid, expired, or has reached its maximum uses. Please request a new code from your Project Guide or HOD."}
              </p>
            </div>
          </div>
        )}

        {/* Success Preview Card */}
        {inviteInfo && !isLookingUp && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    {isFaculty ? (
                      <GraduationCap className="size-4" />
                    ) : (
                      <Users className="size-4" />
                    )}
                  </span>
                  <div>
                    <h4 className="font-semibold text-sm">
                      {isFaculty
                        ? "Faculty Guide Enrollment"
                        : isStudentGroup
                        ? "Student Group Invitation"
                        : "Workspace Access"}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Invitation verified & valid
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="font-mono text-xs bg-background/80"
                >
                  {inviteInfo.code}
                </Badge>
              </div>

              {/* Preview Badge Info */}
              <div className="p-3 rounded-lg bg-background/80 border border-border/60 text-xs space-y-2">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Building className="size-4 text-muted-foreground shrink-0" />
                  <span>
                    Department: <strong>{inviteInfo.workspaceName}</strong>
                  </span>
                </div>

                {inviteInfo.teamCode && (
                  <div className="flex items-center gap-2 text-foreground">
                    <Users className="size-4 text-muted-foreground shrink-0" />
                    <span>
                      Project Group:{" "}
                      <strong className="text-primary">
                        {inviteInfo.teamCode}
                      </strong>
                      {inviteInfo.teamTitle ? ` — ${inviteInfo.teamTitle}` : ""}
                    </span>
                  </div>
                )}

                {inviteInfo.guideName && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GraduationCap className="size-4 shrink-0" />
                    <span>
                      Faculty Guide: <strong>{inviteInfo.guideName}</strong>
                    </span>
                  </div>
                )}

                {inviteInfo.batchName && (
                  <div className="text-muted-foreground text-[11px] pt-1 border-t border-border/40">
                    Academic Cohort: <strong>{inviteInfo.batchName}</strong>
                  </div>
                )}
              </div>

              {/* Dynamic Role / Preview Message */}
              <div className="flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 p-2.5 rounded-md">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  {inviteInfo.previewBadgeText ||
                    `You are joining as ${inviteInfo.roleName || "Member"}`}
                </span>
              </div>
            </div>

            {/* Already a member fallback alert */}
            {alreadyMemberWorkspaceId && (
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between gap-3">
                <span>You are already enrolled in this workspace!</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    router.push(`/workspaces/${alreadyMemberWorkspaceId}`)
                  }
                >
                  Open Workspace
                </Button>
              </div>
            )}

            {/* Join Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                asChild
                disabled={isJoining}
              >
                <Link href="/">Cancel</Link>
              </Button>
              <Button
                onClick={handleConfirmJoin}
                disabled={isJoining}
                className="flex-1 font-semibold gap-2"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    Confirm & Enter
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Empty state prompt */}
        {!inviteInfo && !isLookingUp && !isLookupError && (
          <div className="text-center py-6 text-xs text-muted-foreground space-y-1">
            <p>Don&apos;t have a code?</p>
            <p>
              Ask your Department HOD (for faculty) or Project Guide (for students) to share your join link or code.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
