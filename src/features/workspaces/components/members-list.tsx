"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { ArrowLeftIcon, MoreVerticalIcon, UserPlus, LogOut, ShieldAlert } from "lucide-react";

import { MemberRole } from "@/features/members/types";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { useDeleteMember } from "@/features/members/api/use-delete-member";
import { useUpdateMember } from "@/features/members/api/use-update-member";
import { useTransferOwnership } from "@/features/workspaces/api/use-transfer-ownership";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { InviteModal } from "./invite-modal";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/hooks/use-confirm";
import { Separator } from "@/components/ui/separator";
import { DottedSeparator } from "@/components/dotted-separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const MembersList = () => {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const { canManageMembers } = usePermissions(workspaceId);
  const { data: workspace } = useGetWorkspace({ workspaceId });
  const { data: currentMember } = useCurrentMember({ workspaceId });

  const isCurrentUserOwner = Boolean(workspace && currentMember && workspace.userId === currentMember.userId);
  const currentMemberId = currentMember?.$id || currentMember?.id;

  const [RemoveConfirmDialog, confirmRemove] = useConfirm(
    "Remove member",
    "This member will be removed from the workspace and lose all access.",
    "destructive"
  );

  const [LeaveConfirmDialog, confirmLeave] = useConfirm(
    "Leave workspace",
    "Are you sure you want to leave this workspace? You will lose access to its projects and tasks.",
    "destructive"
  );

  const [TransferConfirmDialog, confirmTransfer] = useConfirm(
    "Transfer Workspace Ownership",
    "Are you sure you want to transfer ownership to this member? You will step down to Administrator.",
    "destructive"
  );
  
  const { data } = useGetMembers({ workspaceId });
  const {
    mutate: deleteMember,
    isPending: isDeletingMember
  } = useDeleteMember();
  const {
    mutate: updateMember,
    isPending: isUpdatingMember
  } = useUpdateMember();
  const {
    mutate: transferOwnership,
    isPending: isTransferring
  } = useTransferOwnership();

  const handleUpdateMember = (memberId: string, role: MemberRole) => {
    updateMember({
      json: { role },
      param: { memberId },
    });
  };

  const handleRemoveMember = async (memberId: string) => {
    const ok = await confirmRemove();
    if (!ok) return;

    deleteMember({ param: { memberId } });
  };

  const handleLeaveWorkspace = async (memberId: string) => {
    const ok = await confirmLeave();
    if (!ok) return;

    deleteMember(
      { param: { memberId } },
      {
        onSuccess: () => {
          router.push("/");
          router.refresh();
        },
      }
    );
  };

  const handleTransferOwnership = async (targetMemberId: string) => {
    const ok = await confirmTransfer();
    if (!ok) return;

    transferOwnership({
      param: { workspaceId },
      json: { targetMemberId },
    });
  };

  return (
    <Card className="w-full h-full border-none shadow-none">
      <RemoveConfirmDialog />
      <LeaveConfirmDialog />
      <TransferConfirmDialog />
      <InviteModal
        isOpen={isInviteOpen}
        setIsOpen={setIsInviteOpen}
        workspaceId={workspaceId}
        inviteCode={workspace?.inviteCode || ""}
      />
      <CardHeader className="flex flex-row items-center justify-between p-7 space-y-0">
        <div className="flex items-center gap-x-4">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/workspaces/${workspaceId}`}>
              <ArrowLeftIcon className="size-4 mr-2" />
              Back
            </Link>
          </Button>
          <CardTitle className="text-xl font-bold">
            Members list
          </CardTitle>
        </div>
        {canManageMembers && (
          <Button onClick={() => setIsInviteOpen(true)} size="sm">
            <UserPlus className="size-4 mr-2" />
            Invite Member
          </Button>
        )}
      </CardHeader>
      <div className="px-7">
        <DottedSeparator />
      </div>
      <CardContent className="p-7">
        {data?.documents.map((member, index) => {
          const isSelf = (member.$id || member.id) === currentMemberId;
          const isTargetOwner = Boolean(workspace && member && workspace.userId === member.userId);
          const memberId = member.$id || member.id;
          const displayRole = (member as unknown as { roleName?: string }).roleName || (isTargetOwner ? "OWNER" : member.role);

          return (
            <Fragment key={memberId}>
              <div className="flex items-center gap-2">
                <MemberAvatar
                  className="size-10"
                  fallbackClassName="text-lg"
                  name={member.name}
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-x-2">
                    <p className="text-sm font-medium">
                      {member.name}
                      {isSelf && <span className="text-xs text-muted-foreground ml-1.5">(You)</span>}
                    </p>
                    <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                      {displayRole}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  {/* Self non-owner leave button */}
                  {isSelf && !isTargetOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleLeaveWorkspace(memberId)}
                      disabled={isDeletingMember}
                    >
                      <LogOut className="size-4 mr-1.5" />
                      Leave
                    </Button>
                  )}

                  {/* Actions for other members */}
                  {!isSelf && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          disabled={isUpdatingMember || isDeletingMember || isTransferring}
                        >
                          <MoreVerticalIcon className="size-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="bottom" align="end" className="w-56">
                        {/* Transfer ownership option (owner only) */}
                        {isCurrentUserOwner && (
                          <>
                            <DropdownMenuItem
                              className="font-medium text-amber-600 focus:text-amber-700"
                              onClick={() => handleTransferOwnership(memberId)}
                            >
                              <ShieldAlert className="size-4 mr-2" />
                              Transfer Ownership
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}

                        {/* Role management for admins and owners */}
                        {canManageMembers && !isTargetOwner && (
                          <>
                            <DropdownMenuItem
                              className="font-medium"
                              onClick={() => handleUpdateMember(memberId, MemberRole.ADMIN)}
                              disabled={displayRole.toLowerCase().includes("admin")}
                            >
                              Set as Administrator
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="font-medium"
                              onClick={() => handleUpdateMember(memberId, MemberRole.PROJECT_MANAGER)}
                              disabled={displayRole.toLowerCase().includes("manager") || displayRole.toLowerCase() === "pm"}
                            >
                              Set as Project Manager
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="font-medium"
                              onClick={() => handleUpdateMember(memberId, MemberRole.MEMBER)}
                              disabled={displayRole.toLowerCase() === "member"}
                            >
                              Set as Member
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="font-medium"
                              onClick={() => handleUpdateMember(memberId, MemberRole.VIEWER)}
                              disabled={displayRole.toLowerCase().includes("viewer")}
                            >
                              Set as Viewer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="font-medium"
                              onClick={() => handleUpdateMember(memberId, MemberRole.GUEST)}
                              disabled={displayRole.toLowerCase().includes("guest")}
                            >
                              Set as Guest
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="font-medium text-destructive focus:text-destructive"
                              onClick={() => handleRemoveMember(memberId)}
                            >
                              Remove {member.name}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              {index < data.documents.length - 1 && (
                <Separator className="my-2.5" />
              )}
            </Fragment>
          );
        })}
      </CardContent>
    </Card>
  );
};
