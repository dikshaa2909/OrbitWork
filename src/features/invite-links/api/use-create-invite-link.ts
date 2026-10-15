import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface CreateInviteLinkPayload {
  workspaceId: string;
  roleId?: string;
  label?: string;
  expiresAt?: string;
  maxUses?: number;
}

export const useCreateInviteLink = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (json: CreateInviteLinkPayload) => {
      const response = await client.api["invite-links"].$post({ json });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Failed to generate invite link");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Role-bound invite link generated");
      queryClient.invalidateQueries({ queryKey: ["invite-links"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to generate invite link");
    },
  });

  return mutation;
};
