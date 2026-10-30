"use client";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { ChatView } from "@/features/chat/components/chat-view";

export const ChatClient = () => {
  const workspaceId = useWorkspaceId();

  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in">
      <ChatView workspaceId={workspaceId} />
    </div>
  );
};

