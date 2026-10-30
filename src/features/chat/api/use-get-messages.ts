import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { Message } from "../types";

interface UseGetMessagesProps {
  channelId?: string | null;
  parentMessageId?: string;
}

export const useGetMessages = ({
  channelId,
  parentMessageId,
}: UseGetMessagesProps) => {
  const query = useQuery({
    enabled: !!channelId,
    queryKey: ["chat-messages", channelId, parentMessageId || "root"],
    queryFn: async () => {
      if (!channelId) return [];

      const response = await client.api.chat.channels[":channelId"].messages.$get({
        param: { channelId },
        query: parentMessageId ? { parentMessageId } : {},
      });

      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }

      const { data } = await response.json();
      return data as Message[];
    },
    refetchInterval: 8000, // Backup polling interval
  });

  return query;
};

