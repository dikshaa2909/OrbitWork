"use client";

import React from "react";
import {
  Hash,
  Lock,
  Users,
  FolderKanban,
  Plus,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { Channel } from "../types";

interface ChannelSidebarProps {
  channels: Channel[];
  selectedChannelId: string | null;
  onSelectChannel: (channel: Channel) => void;
  onOpenCreateDialog: () => void;
  onOpenNewDMDialog: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  channels,
  selectedChannelId,
  onSelectChannel,
  onOpenCreateDialog,
  onOpenNewDMDialog,
}) => {
  const workspaceChannels = channels.filter((c) => c.type === "WORKSPACE");
  const projectChannels = channels.filter((c) => c.type === "PROJECT");
  const teamChannels = channels.filter((c) => c.type === "TEAM");
  const privateChannels = channels.filter((c) => c.type === "PRIVATE");
  const dms = channels.filter((c) => c.type === "DM");

  const renderChannelItem = (ch: Channel) => {
    const isSelected = ch.id === selectedChannelId;
    const Icon =
      ch.type === "WORKSPACE"
        ? Hash
        : ch.type === "PROJECT"
        ? FolderKanban
        : ch.type === "TEAM"
        ? Users
        : Lock;

    return (
      <button
        type="button"
        key={ch.id}
        onClick={() => onSelectChannel(ch)}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
          isSelected
            ? "bg-primary text-primary-foreground font-semibold"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate">{ch.name}</span>
        </div>
        {Boolean(ch.unread_count && ch.unread_count > 0) && (
          <span className="size-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
            {ch.unread_count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="w-64 border-r bg-card flex flex-col h-full shrink-0">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <MessageCircle className="size-4 text-indigo-600" />
          <span>Channels & DMs</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenCreateDialog}
          className="size-7 p-0 text-muted-foreground hover:text-foreground"
          title="Create channel"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-2 space-y-4">
        {/* Workspace public channels */}
        <div className="space-y-1 mb-4">
          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Workspace
          </div>
          {workspaceChannels.length === 0 ? (
            <p className="px-2 text-[11px] text-muted-foreground italic">
              No public channels
            </p>
          ) : (
            workspaceChannels.map(renderChannelItem)
          )}
        </div>

        {/* Project channels */}
        {projectChannels.length > 0 && (
          <div className="space-y-1 mb-4">
            <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Projects
            </div>
            {projectChannels.map(renderChannelItem)}
          </div>
        )}

        {/* Team channels */}
        {teamChannels.length > 0 && (
          <div className="space-y-1 mb-4">
            <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Teams
            </div>
            {teamChannels.map(renderChannelItem)}
          </div>
        )}

        {/* Private channels */}
        {privateChannels.length > 0 && (
          <div className="space-y-1 mb-4">
            <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Private
            </div>
            {privateChannels.map(renderChannelItem)}
          </div>
        )}

        {/* Direct Messages */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Direct Messages
            </span>
            <button
              type="button"
              onClick={onOpenNewDMDialog}
              className="text-muted-foreground hover:text-foreground"
              title="New direct message"
            >
              <Plus className="size-3" />
            </button>
          </div>
          {dms.length === 0 ? (
            <p className="px-2 text-[11px] text-muted-foreground italic">
              No direct messages
            </p>
          ) : (
            dms.map((dm) => {
              const isSelected = dm.id === selectedChannelId;
              return (
                <button
                  type="button"
                  key={dm.id}
                  onClick={() => onSelectChannel(dm)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <MemberAvatar
                      name={dm.name || "Teammate"}
                      className="size-4 text-[9px] shrink-0"
                    />
                    <span className="truncate">{dm.name}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
