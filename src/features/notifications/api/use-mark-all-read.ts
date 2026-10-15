import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface MarkAllReadPayload {
  workspaceId: string;
}

export const useMarkAllRead = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ workspaceId }: MarkAllReadPayload) => {
      const response = await client.api.notifications["read-all"].$post({
        json: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to mark all notifications as read");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return mutation;
};
