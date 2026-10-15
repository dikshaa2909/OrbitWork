"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Mail,
  Link as LinkIcon,
  RotateCcw,
  Trash2,
  Loader2,
  UserPlus,
  Info,
  ShieldCheck,
  Plus,
} from "lucide-react";

import { ResponsiveModal } from "@/components/responsive-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DottedSeparator } from "@/components/dotted-separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirm } from "@/hooks/use-confirm";
import { MemberRole } from "@/features/members/types";

import { useResetInviteCode } from "../api/use-reset-invite-code";
import { useGetInvites } from "../api/use-get-invites";
import { useCreateInvite } from "../api/use-create-invite";
import { useRevokeInvite } from "../api/use-revoke-invite";
import { useGetInviteLinks } from "@/features/invite-links/api/use-get-invite-links";
import { useCreateInviteLink } from "@/features/invite-links/api/use-create-invite-link";
import { useRevokeInviteLink } from "@/features/invite-links/api/use-revoke-invite-link";
import { useGetRoles } from "@/features/roles/api/use-get-roles";
import type { InviteLink } from "@/features/access-requests/types";

interface InviteModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  workspaceId: string;
  inviteCode: string;
}

export const InviteModal = ({
  isOpen,
  setIsOpen,
  workspaceId,
  inviteCode,
}: InviteModalProps) => {
  const [ResetDialog, confirmReset] = useConfirm(
    "Reset invite link",
    "This will invalidate the current invite link and code. Existing links will stop working.",
    "destructive"
  );

  const fullInviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/workspaces/${workspaceId}/join/${inviteCode}`
    : "";

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  const { mutate: resetInviteCode, isPending: isResetting } = useResetInviteCode();
  const handleReset = async () => {
    const ok = await confirmReset();
    if (!ok) return;

    resetInviteCode({
      param: { workspaceId },
    });
  };

  // Email Invite
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>(MemberRole.MEMBER);
  const { data: pendingInvites, isLoading: isLoadingInvites } = useGetInvites({ workspaceId });
  const { mutate: createInvite, isPending: isSending } = useCreateInvite();
  const { mutate: revokeInvite, isPending: isRevoking } = useRevokeInvite();

  // Role-Bound Links State
  const [linkLabel, setLinkLabel] = useState("");
  const [linkRoleId, setLinkRoleId] = useState<string>("");
  const [linkExpiryDays, setLinkExpiryDays] = useState<string>("7");
  const [linkMaxUses, setLinkMaxUses] = useState<string>("10");

  const { data: roles } = useGetRoles({ workspaceId });
  const { data: linksData, isLoading: isLoadingLinks } = useGetInviteLinks({ workspaceId });
  const { mutate: createLink, isPending: isCreatingLink } = useCreateInviteLink();
  const { mutate: revokeLink, isPending: isRevokingLink } = useRevokeInviteLink();

  const activeLinks = (linksData?.documents || []) as InviteLink[];

  const handleCreateRoleLink = (e: React.FormEvent) => {
    e.preventDefault();
    let expiresAt: string | undefined = undefined;
    if (linkExpiryDays !== "never") {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(linkExpiryDays, 10));
      expiresAt = d.toISOString();
    }
    const maxUses = linkMaxUses !== "unlimited" ? parseInt(linkMaxUses, 10) : undefined;

    createLink(
      {
        workspaceId,
        roleId: linkRoleId || undefined,
        label: linkLabel.trim() || undefined,
        expiresAt,
        maxUses,
      },
      {
        onSuccess: () => {
          setLinkLabel("");
        },
      }
    );
  };

  const handleSendEmailInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    createInvite(
      {
        param: { workspaceId },
        json: { email, role },
      },
      {
        onSuccess: () => {
          setEmail("");
          setRole(MemberRole.MEMBER);
        },
      }
    );
  };

  return (
    <>
      <ResetDialog />
      <ResponsiveModal open={isOpen} onOpenChange={setIsOpen}>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <UserPlus className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Invite Team Members
              </h2>
              <p className="text-xs text-muted-foreground">
                Manage invitations and generate role-bound join links.
              </p>
            </div>
          </div>

          <DottedSeparator />

          <Tabs defaultValue="links" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="links" className="text-xs flex items-center gap-1">
                <ShieldCheck className="size-3.5" />
                Role Links
              </TabsTrigger>
              <TabsTrigger value="standard" className="text-xs flex items-center gap-1">
                <LinkIcon className="size-3.5" />
                Quick Link
              </TabsTrigger>
              <TabsTrigger value="email" className="text-xs flex items-center gap-1">
                <Mail className="size-3.5" />
                Email Invite
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: ROLE-BOUND LINKS */}
            <TabsContent value="links" className="space-y-4 pt-3">
              <form onSubmit={handleCreateRoleLink} className="space-y-3 p-3 bg-neutral-50 dark:bg-neutral-900/40 rounded-lg border">
                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Generate Role-Specific Invite Link
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Assigned Role
                    </label>
                    <Select value={linkRoleId} onValueChange={setLinkRoleId}>
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Default (Viewer)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Default View-Only (Viewer)</SelectItem>
                        {roles?.map((r) => {
                          const val = r.id || (r as unknown as { $id?: string }).$id || "";
                          return (
                            <SelectItem key={val} value={val}>
                              {r.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Link Label <span className="font-normal">(optional)</span>
                    </label>
                    <Input
                      placeholder="e.g. Q4 Contractors"
                      value={linkLabel}
                      onChange={(e) => setLinkLabel(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Expires In
                    </label>
                    <Select value={linkExpiryDays} onValueChange={setLinkExpiryDays}>
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">24 Hours</SelectItem>
                        <SelectItem value="7">7 Days</SelectItem>
                        <SelectItem value="30">30 Days</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Max Uses
                    </label>
                    <Select value={linkMaxUses} onValueChange={setLinkMaxUses}>
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 use (Single)</SelectItem>
                        <SelectItem value="5">5 uses</SelectItem>
                        <SelectItem value="10">10 uses</SelectItem>
                        <SelectItem value="50">50 uses</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button type="submit" size="sm" disabled={isCreatingLink} className="w-full text-xs h-8 gap-1">
                  <Plus className="size-3.5" />
                  {isCreatingLink ? "Generating..." : "Generate Role-Bound Link"}
                </Button>
              </form>

              {/* Active Links list */}
              <div className="space-y-2 pt-1">
                <h3 className="text-xs font-bold uppercase text-neutral-500 tracking-wider">
                  Active Role Links ({activeLinks.length})
                </h3>
                {isLoadingLinks ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : activeLinks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-md border border-dashed">
                    No custom role links generated yet.
                  </p>
                ) : (
                  <div className="divide-y border rounded-md max-h-48 overflow-y-auto">
                    {activeLinks.map((link) => {
                      const joinUrl = typeof window !== "undefined"
                        ? `${window.location.origin}/workspaces/${workspaceId}/join/${link.code}`
                        : "";
                      return (
                        <div key={link.id} className="p-2.5 flex items-center justify-between text-xs gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                {link.label || "Invite Link"}
                              </span>
                              <Badge variant="secondary" className="text-[9px] uppercase font-bold py-0 h-4">
                                {link.roleName || "VIEWER"}
                              </Badge>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Uses: {link.uses} {link.maxUses ? `/ ${link.maxUses}` : ""} •{" "}
                              {link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}` : "Never expires"}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleCopy(joinUrl)}
                            >
                              <Copy className="size-3 mr-1" />
                              Copy
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-neutral-400 hover:text-destructive"
                              onClick={() => revokeLink({ linkId: link.id, workspaceId })}
                              disabled={isRevokingLink}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 2: STANDARD QUICK LINK */}
            <TabsContent value="standard" className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Workspace Join Link (Default Member)
                </label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={fullInviteLink} className="text-xs font-mono" />
                  <Button onClick={() => handleCopy(fullInviteLink)} size="sm" variant="secondary" className="shrink-0">
                    <Copy className="size-4 mr-1.5" />
                    Copy
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-neutral-100 dark:bg-neutral-900 border text-xs text-neutral-600 dark:text-neutral-400">
                <Info className="size-4 text-neutral-500 shrink-0 mt-0.5" />
                <div>
                  Members joining via this link join with standard Member permissions.
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <p className="text-xs text-muted-foreground">
                  Need to invalidate leaked links?
                </p>
                <Button
                  onClick={handleReset}
                  disabled={isResetting}
                  size="sm"
                  variant="outline"
                  className="text-xs text-destructive hover:text-destructive"
                >
                  <RotateCcw className="size-3.5 mr-1" />
                  Reset Link
                </Button>
              </div>
            </TabsContent>

            {/* TAB 3: EMAIL INVITE */}
            <TabsContent value="email" className="space-y-4 pt-3">
              <form onSubmit={handleSendEmailInvite} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1 block">
                      Email address
                    </label>
                    <Input
                      type="email"
                      placeholder="teammate@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSending}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1 block">
                      Assign Role
                    </label>
                    <Select
                      value={role}
                      onValueChange={(val) => setRole(val as MemberRole)}
                      disabled={isSending}
                    >
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MemberRole.MEMBER}>Member (Default)</SelectItem>
                        <SelectItem value={MemberRole.PROJECT_MANAGER}>Project Manager</SelectItem>
                        <SelectItem value={MemberRole.ADMIN}>Administrator</SelectItem>
                        <SelectItem value={MemberRole.VIEWER}>Viewer (Read-only)</SelectItem>
                        <SelectItem value={MemberRole.GUEST}>Guest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button type="submit" size="sm" className="w-full text-xs" disabled={isSending || !email}>
                  {isSending ? (
                    <>
                      <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                      Sending Invitation...
                    </>
                  ) : (
                    "Send Invitation"
                  )}
                </Button>
              </form>

              {/* Pending Invites List */}
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase text-neutral-500 tracking-wider">
                  Pending Invitations {pendingInvites?.length ? `(${pendingInvites.length})` : ""}
                </h3>
                {isLoadingInvites ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingInvites && pendingInvites.length > 0 ? (
                  <div className="divide-y border rounded-md max-h-48 overflow-y-auto">
                    {pendingInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between p-2.5 text-xs"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="font-medium truncate text-neutral-900 dark:text-neutral-100">
                            {invite.email}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Sent {new Date(invite.created_at || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-[9px] uppercase font-bold py-0 h-4">
                            {invite.role}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-neutral-400 hover:text-destructive"
                            onClick={() =>
                              revokeInvite({
                                param: {
                                  workspaceId,
                                  inviteId: invite.id,
                                },
                              })
                            }
                            disabled={isRevoking}
                            title="Revoke invite"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-md border border-dashed">
                    No pending email invitations.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ResponsiveModal>
    </>
  );
};
