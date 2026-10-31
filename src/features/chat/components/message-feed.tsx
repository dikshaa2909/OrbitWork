"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo, memo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Send,
  MessageSquare,
  CheckSquare,
  Hash,
  Lock,
  Users,
  FolderKanban,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useToggleReaction } from "../api/use-toggle-reaction";
import { Channel, Message } from "../types";

interface MessageFeedProps {
  channel: Channel;
  messages: Message[];
  isLoading: boolean;
  onOpenThread: (message: Message) => void;
  onConvertToTask: (message: Message) => void;
}

const COMMON_EMOJIS = ["👍", "❤️", "🎉", "🚀", "👀", "🔥"];

interface MessageRowProps {
  msg: Message;
  onOpenThread: (msg: Message) => void;
  onConvertToTask: (msg: Message) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
}

const MessageRow = memo(({ msg, onOpenThread, onConvertToTask, onToggleReaction }: MessageRowProps) => {
  const formattedTime = useMemo(
    () => formatDistanceToNow(new Date(msg.created_at), { addSuffix: true }),
    [msg.created_at]
  );

  const uniqueEmojis = useMemo(
    () => Array.from(new Set((msg.reactions || []).map((r) => r.emoji))),
    [msg.reactions]
  );

  const isGuide = msg.author_role === "FACULTY_GUIDE" || msg.author_role_label === "Faculty Guide";
  const isLead = msg.author_role === "TEAM_LEAD" || msg.author_role_label === "Team Lead";
  const isHod = msg.author_role === "HOD" || msg.author_role_label === "HOD" || msg.author_role_label === "HOD / Coordinator";
  const isStudent = msg.author_role === "STUDENT" || msg.author_role_label === "Student";

  const rawName = msg.author_name || "Teammate";
  const displayName = useMemo(() => {
    if (isGuide) {
      return rawName.toLowerCase().startsWith("prof") ? rawName : `Prof. ${rawName}`;
    }
    if (isHod) {
      return (rawName.toLowerCase().startsWith("dr") || rawName.toLowerCase().startsWith("prof"))
        ? rawName
        : `Dr./Prof. ${rawName}`;
    }
    return rawName;
  }, [isGuide, isHod, rawName]);

  return (
    <div className="group flex items-start gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors relative">
      <MemberAvatar
        name={displayName}
        className="size-8 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-xs text-foreground truncate max-w-[200px]">
            {displayName}
          </span>
          {isGuide ? (
            <Badge className="text-[9px] font-bold px-1.5 py-0 h-4 rounded-sm tracking-tight bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200">
              Faculty Guide
            </Badge>
          ) : isLead ? (
            <Badge className="text-[9px] font-bold px-1.5 py-0 h-4 rounded-sm tracking-tight bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200">
              Team Lead
            </Badge>
          ) : isHod ? (
            <Badge variant="destructive" className="text-[9px] font-bold px-1.5 py-0 h-4 rounded-sm tracking-tight bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200">
              HOD
            </Badge>
          ) : isStudent ? (
            <Badge variant="outline" className="text-[9px] font-medium px-1.5 py-0 h-4 rounded-sm tracking-tight text-muted-foreground border-border">
              Student
            </Badge>
          ) : null}
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formattedTime}
          </span>
          {msg.task_id && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded font-medium shrink-0">
              <CheckSquare className="size-2.5" />
              Task linked
            </span>
          )}
        </div>

        <div className="mt-1 text-sm overflow-hidden break-words">
          <RichTextViewer content={msg.body} />
        </div>

        {/* Reactions list */}
        {Boolean(msg.reactions && msg.reactions.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {uniqueEmojis.map((emoji) => {
              const count = (msg.reactions || []).filter((r) => r.emoji === emoji).length;
              return (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => onToggleReaction(msg.id, emoji)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted/60 hover:bg-muted border text-foreground transition-transform active:scale-95"
                >
                  <span>{emoji}</span>
                  <span className="text-[10px] font-semibold">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action buttons (hover) */}
      <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-card border rounded-md shadow-sm p-0.5">
        {COMMON_EMOJIS.slice(0, 3).map((emoji) => (
          <button
            type="button"
            key={emoji}
            onClick={() => onToggleReaction(msg.id, emoji)}
            className="p-1 hover:bg-muted rounded text-xs"
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onOpenThread(msg)}
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
          title="Reply in thread"
        >
          <MessageSquare className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onConvertToTask(msg)}
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
          title="Convert to task"
        >
          <CheckSquare className="size-3.5" />
        </button>
      </div>
    </div>
  );
});

MessageRow.displayName = "MessageRow";

export const MessageFeed: React.FC<MessageFeedProps> = ({
  channel,
  messages,
  isLoading,
  onOpenThread,
  onConvertToTask,
}) => {
  const [content, setContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { mutate: sendMessage, isPending: isSending } = useSendMessage();
  const { mutate: toggleReaction } = useToggleReaction();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!content.trim() || isSending) return;

      sendMessage(
        {
          param: { channelId: channel.id },
          json: { body: content },
        },
        {
          onSuccess: () => {
            setContent("");
          },
        }
      );
    },
    [channel.id, content, isSending, sendMessage]
  );

  const handleToggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      toggleReaction({
        param: { messageId },
        json: { emoji },
      });
    },
    [toggleReaction]
  );

  const headerIcon = useMemo(() => {
    if (channel.type === "WORKSPACE") return <Hash className="size-5" />;
    if (channel.type === "PROJECT") return <FolderKanban className="size-5" />;
    if (channel.type === "TEAM") return <Users className="size-5" />;
    return <Lock className="size-5" />;
  }, [channel.type]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Top Channel Header */}
      <div className="h-14 border-b px-6 flex items-center justify-between shrink-0 bg-card">
        {channel.type === "DM" ? (
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <MemberAvatar
                name={channel.dm_partner?.name || channel.name || "Direct Message"}
                className="size-8"
              />
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm text-foreground flex items-center gap-2 truncate">
                {channel.dm_partner?.name || channel.name || "Direct Message"}
                <Badge variant="outline" className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                  Direct Message
                </Badge>
              </h2>
              <p className="text-[11px] text-muted-foreground truncate max-w-md">
                {channel.dm_partner?.email || "1-on-1 Conversation"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="text-muted-foreground shrink-0">{headerIcon}</div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm text-foreground flex items-center gap-2 truncate">
                {channel.name}
                {channel.team_id && (
                  <Badge variant="secondary" className="text-[10px] font-semibold text-primary bg-primary/10">
                    Academic Group
                  </Badge>
                )}
              </h2>
              {channel.description && (
                <p className="text-[11px] text-muted-foreground truncate max-w-md">
                  {channel.description}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {channel.team_id && (
            <span className="hidden sm:inline-block text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
              Private Group & Guide Chat
            </span>
          )}
          <span className="text-xs uppercase font-semibold text-muted-foreground px-2 py-0.5 rounded bg-muted shrink-0">
            {channel.type}
          </span>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Loading channel messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            <p className="font-semibold text-sm text-foreground mb-1">
              {channel.type === "DM"
                ? `Direct Message with ${channel.name}`
                : `Welcome to #${channel.name}!`}
            </p>
            <p>
              {channel.type === "DM"
                ? "This is the beginning of your private 1-on-1 direct message history."
                : channel.team_id
                ? "This is the private discussion channel for your capstone project group. Only assigned group students and your Faculty Guide have access."
                : `This is the start of the #${channel.name} channel.`}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              onOpenThread={onOpenThread}
              onConvertToTask={onConvertToTask}
              onToggleReaction={handleToggleReaction}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <form onSubmit={handleSend} className="p-4 border-t bg-card shrink-0">
        <RichTextEditor
          placeholder={`Message #${channel.name}...`}
          value={content}
          onChange={setContent}
          disabled={isSending}
          minHeight="70px"
        />
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                type="button"
                key={emoji}
                onClick={() => setContent((prev) => prev + ` ${emoji} `)}
                className="p-1 hover:bg-muted rounded text-xs"
              >
                {emoji}
              </button>
            ))}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!content.trim() || isSending}
            className="gap-1.5"
          >
            <Send className="size-3.5" />
            Send
          </Button>
        </div>
      </form>
    </div>
  );
};
