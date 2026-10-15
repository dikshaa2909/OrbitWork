import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client } from "@/lib/rpc";
import { MemberRole } from "@/features/members/types";

interface UseCreateInviteProps {
  param: { workspaceId: string };
  json: { email: string; role: MemberRole };
}

export const useCreateInvite = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ param, json }: UseCreateInviteProps) => {
      const response = await client.api.workspaces[":workspaceId"]["invites"].$post({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to send invitation");
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Invitation created and sent!");
      queryClient.invalidateQueries({
        queryKey: ["invites", variables.param.workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  return mutation;
};
