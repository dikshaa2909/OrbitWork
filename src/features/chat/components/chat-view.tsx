"use client";

import React, { useState, useEffect } from "react";
import { ChannelSidebar } from "./channel-sidebar";
import { MessageFeed } from "./message-feed";
import { ThreadSidebar } from "./thread-sidebar";
import { CreateChannelDialog } from "./create-channel-dialog";
import { NewDMDialog } from "./new-dm-dialog";
import { ConvertToTaskDialog } from "./convert-to-task-dialog";
import { useGetChannels } from "../api/use-get-channels";
import { useChatMessages } from "../hooks/use-chat-messages";
import { Channel, Message } from "../types";

interface ChatViewProps {
  workspaceId: string;
}

export const ChatView: React.FC<ChatViewProps> = ({ workspaceId }) => {
  const { data: channels = [], isLoading: isChannelsLoading } = useGetChannels({
    workspaceId,
  });

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(
    null
  );
  const [taskConvertMessage, setTaskConvertMessage] = useState<Message | null>(
    null
  );

  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [newDMOpen, setNewDMOpen] = useState(false);

  // Auto-select first channel when channels load
  useEffect(() => {
    if (!selectedChannel && channels.length > 0) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel]);

  const { messages, isLoading: isMessagesLoading } = useChatMessages({
    channelId: selectedChannel?.id,
  });

  return (
    <div className="flex h-[calc(100vh-140px)] w-full rounded-xl border bg-card overflow-hidden shadow-sm">
      {/* Channels Sidebar */}
      <ChannelSidebar
        channels={channels}
        selectedChannelId={selectedChannel?.id || null}
        onSelectChannel={(ch) => {
          setSelectedChannel(ch);
          setActiveThreadMessage(null);
        }}
        onOpenCreateDialog={() => setCreateChannelOpen(true)}
        onOpenNewDMDialog={() => setNewDMOpen(true)}
      />

      {/* Main Message Feed */}
      {selectedChannel ? (
        <MessageFeed
          channel={selectedChannel}
          messages={messages}
          isLoading={isMessagesLoading}
          onOpenThread={(msg) => setActiveThreadMessage(msg)}
          onConvertToTask={(msg) => setTaskConvertMessage(msg)}
        />
      ) : isChannelsLoading ? (
        <div className="flex-1 flex flex-col p-6 space-y-4 animate-pulse">
          <div className="h-10 w-48 bg-muted rounded" />
          <div className="space-y-3 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-muted shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-32 bg-muted rounded" />
                  <div className="h-4 w-3/4 bg-muted/60 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">Select or create a channel</p>
          <p className="text-xs max-w-sm">
            Choose a workspace, project, or team channel from the sidebar, or send a direct message.
          </p>
        </div>
      )}

      {/* Thread Sidebar */}
      {activeThreadMessage && selectedChannel && (
        <ThreadSidebar
          parentMessage={activeThreadMessage}
          channelId={selectedChannel.id}
          onClose={() => setActiveThreadMessage(null)}
        />
      )}

      {/* Dialogs */}
      <CreateChannelDialog
        open={createChannelOpen}
        onOpenChange={setCreateChannelOpen}
        workspaceId={workspaceId}
      />

      <NewDMDialog
        open={newDMOpen}
        onOpenChange={setNewDMOpen}
        workspaceId={workspaceId}
        onChannelCreated={(ch) => setSelectedChannel(ch)}
      />

      <ConvertToTaskDialog
        open={Boolean(taskConvertMessage)}
        onOpenChange={(open) => !open && setTaskConvertMessage(null)}
        message={taskConvertMessage}
        workspaceId={workspaceId}
      />
    </div>
  );
};

