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
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { Loader2, MessageSquare } from "lucide-react";
import { useCreateChannel } from "../api/use-create-channel";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { Channel } from "../types";

interface NewDMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onChannelCreated?: (channel: Channel) => void;
}

export const NewDMDialog: React.FC<NewDMDialogProps> = ({
  open,
  onOpenChange,
  workspaceId,
  onChannelCreated,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const { data: membersData } = useGetMembers({ workspaceId });
  const members = membersData?.documents || [];

  const { mutate: createChannel, isPending } = useCreateChannel();

  const handleStartDM = () => {
    if (!selectedMemberId) return;

    createChannel(
      {
        json: {
          workspaceId,
          type: "DM",
          recipientMemberId: selectedMemberId,
        },
      },
      {
        onSuccess: (res) => {
          onOpenChange(false);
          setSelectedMemberId(null);
          if (res.data) {
            onChannelCreated?.(res.data as Channel);
          }
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-5 text-indigo-600" />
            New Direct Message
          </DialogTitle>
          <DialogDescription>
            Select a workspace member to start a private 1-on-1 direct conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-60 overflow-y-auto space-y-1 py-2">
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No members found
            </p>
          ) : (
            members.map((m) => {
              const mId = (m.userId || m.$id || m.id) as string;
              const isSelected = selectedMemberId === mId;

              return (
                <button
                  type="button"
                  key={mId}
                  onClick={() => setSelectedMemberId(mId)}
                  className={`w-full flex items-center gap-3 p-2 rounded-md text-left text-xs transition-colors ${
                    isSelected
                      ? "bg-accent text-accent-foreground font-semibold"
                      : "hover:bg-muted"
                  }`}
                >
                  <MemberAvatar name={m.name || m.email} className="size-7" />
                  <div className="truncate flex-1">
                    <p className="font-medium truncate">{m.name || "Member"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {m.email}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                    {m.role}
                  </span>
                </button>
              );
            })
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
            onClick={handleStartDM}
            disabled={!selectedMemberId || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              "Start Conversation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

