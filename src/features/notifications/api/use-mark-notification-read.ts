import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface MarkReadPayload {
  notificationId: string;
}

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ notificationId }: MarkReadPayload) => {
      const response = await client.api.notifications[":notificationId"]["read"].$patch({
        param: { notificationId },
      });

      if (!response.ok) {
        throw new Error("Failed to mark notification as read");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return mutation;
};
