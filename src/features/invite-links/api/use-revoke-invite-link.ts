import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface RevokeInviteLinkPayload {
  linkId: string;
  workspaceId: string;
}

export const useRevokeInviteLink = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ linkId, workspaceId }: RevokeInviteLinkPayload) => {
      const response = await client.api["invite-links"][":linkId"].$delete({
        param: { linkId },
        json: { workspaceId },
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Failed to revoke invite link");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.info("Invite link revoked");
      queryClient.invalidateQueries({ queryKey: ["invite-links"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to revoke invite link");
    },
  });

  return mutation;
};
