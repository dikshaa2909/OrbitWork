import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface ApproveAccessRequestPayload {
  requestId: string;
  workspaceId: string;
  grantType: "ONE_TIME" | "TIME_LIMITED" | "PERMANENT";
  expiresAt?: string;
  reviewNote?: string;
}

export const useApproveAccessRequest = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ requestId, workspaceId, grantType, expiresAt, reviewNote }: ApproveAccessRequestPayload) => {
      const response = await client.api["access-requests"][":requestId"]["approve"].$post({
        param: { requestId },
        json: { workspaceId, grantType, expiresAt, reviewNote },
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Failed to approve request");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Access request approved");
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["effective-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to approve request");
    },
  });

  return mutation;
};
