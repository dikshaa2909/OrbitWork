"use client";

import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { X, Send } from "lucide-react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { RichTextViewer } from "@/components/editor/rich-text-viewer";

const RichTextEditor = dynamic(
  () =>
    import("@/components/editor/rich-text-editor").then(
      (mod) => mod.RichTextEditor
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-20 w-full bg-muted/20 border rounded-md animate-pulse p-3 text-xs text-muted-foreground flex items-center justify-center">
        Loading editor...
      </div>
    ),
  }
);
import { useSendMessage } from "../api/use-send-message";
import { useGetMessages } from "../api/use-get-messages";
import { Message } from "../types";

interface ThreadSidebarProps {
  parentMessage: Message;
  channelId: string;
  onClose: () => void;
}

export const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
  parentMessage,
  channelId,
  onClose,
}) => {
  const [replyContent, setReplyContent] = useState("");

  const { data: replies = [], isLoading } = useGetMessages({
    channelId,
    parentMessageId: parentMessage.id,
  });

  const { mutate: sendMessage, isPending } = useSendMessage();

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || isPending) return;

    sendMessage(
      {
        param: { channelId },
        json: {
          body: replyContent,
          parentMessageId: parentMessage.id,
        },
      },
      {
        onSuccess: () => {
          setReplyContent("");
        },
      }
    );
  };

  return (
    <div className="w-80 border-l bg-card flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="h-14 border-b px-4 flex items-center justify-between shrink-0">
        <h3 className="font-bold text-sm text-foreground">Thread</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="size-7 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Parent message & replies */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Parent message card */}
        <div className="p-3 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2 mb-1.5">
            <MemberAvatar
              name={parentMessage.author_name || "Teammate"}
              className="size-6"
            />
            <span className="font-semibold text-xs text-foreground">
              {parentMessage.author_name || "Teammate"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(parentMessage.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>
          <RichTextViewer content={parentMessage.body} />
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-[10px] text-muted-foreground font-semibold">
              Replies
            </span>
          </div>
        </div>

        {/* Replies list */}
        {isLoading ? (
          <p className="text-center text-xs text-muted-foreground">
            Loading replies...
          </p>
        ) : replies.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">
            No replies yet. Start the thread!
          </p>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-2.5 text-xs">
              <MemberAvatar
                name={reply.author_name || "Teammate"}
                className="size-6 mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {reply.author_name || "Teammate"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(reply.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <div className="mt-1">
                  <RichTextViewer content={reply.body} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply Composer */}
      <form onSubmit={handleSendReply} className="p-3 border-t bg-card shrink-0">
        <RichTextEditor
          placeholder="Reply to thread..."
          value={replyContent}
          onChange={setReplyContent}
          disabled={isPending}
          minHeight="60px"
        />
        <div className="flex justify-end mt-2">
          <Button
            type="submit"
            size="sm"
            disabled={!replyContent.trim() || isPending}
            className="gap-1.5"
          >
            <Send className="size-3" />
            Reply
          </Button>
        </div>
      </form>
    </div>
  );
};

