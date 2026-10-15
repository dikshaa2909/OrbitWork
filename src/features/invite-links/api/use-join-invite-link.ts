import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface JoinInviteLinkPayload {
  code: string;
}

export const useJoinInviteLink = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (json: JoinInviteLinkPayload) => {
      const response = await client.api["invite-links"]["join"].$post({ json });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Failed to join workspace");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Successfully joined workspace!");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to join workspace");
    },
  });

  return mutation;
};
