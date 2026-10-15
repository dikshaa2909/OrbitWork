import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

interface UseRevokeInviteProps {
  param: { workspaceId: string; inviteId: string };
}

export const useRevokeInvite = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ param }: UseRevokeInviteProps) => {
      const response = await client.api.workspaces[":workspaceId"]["invites"][":inviteId"].$delete({
        param,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to revoke invitation");
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Invitation revoked");
      queryClient.invalidateQueries({
        queryKey: ["invites", variables.param.workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to revoke invitation");
    },
  });

  return mutation;
};
