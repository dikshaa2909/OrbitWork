import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { Channel } from "../types";

interface UseGetChannelsProps {
  workspaceId?: string;
}

export const useGetChannels = ({ workspaceId }: UseGetChannelsProps = {}) => {
  const query = useQuery({
    enabled: !!workspaceId,
    queryKey: ["chat-channels", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      const response = await client.api.chat.channels.$get({
        query: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch channels");
      }

      const { data } = await response.json();
      return data as Channel[];
    },
  });

  return query;
};

