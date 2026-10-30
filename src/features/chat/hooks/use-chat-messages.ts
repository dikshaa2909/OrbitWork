"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/oauth";
import { useGetMessages } from "../api/use-get-messages";
import { Message } from "../types";

interface UseChatMessagesProps {
  channelId?: string | null;
  parentMessageId?: string;
}

export const useChatMessages = ({
  channelId,
  parentMessageId,
}: UseChatMessagesProps) => {
  const queryClient = useQueryClient();
  const messagesQuery = useGetMessages({ channelId, parentMessageId });

  useEffect(() => {
    if (!channelId) return;

    const supabase = getSupabaseBrowserClient();

    // Subscribe to realtime changes on messages table for this channel
    const channel = supabase
      .channel(`chat:messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["chat-messages", channelId],
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["chat-messages", channelId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, queryClient]);

  return {
    ...messagesQuery,
    messages: (messagesQuery.data || []) as Message[],
  };
};

