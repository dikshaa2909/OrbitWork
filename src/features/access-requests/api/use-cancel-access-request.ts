import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface CancelAccessRequestPayload {
  requestId: string;
  workspaceId: string;
}

export const useCancelAccessRequest = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ requestId, workspaceId }: CancelAccessRequestPayload) => {
      const response = await client.api["access-requests"][":requestId"]["cancel"].$post({
        param: { requestId },
        json: { workspaceId },
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Failed to cancel request");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.info("Access request cancelled");
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to cancel request");
    },
  });

  return mutation;
};
