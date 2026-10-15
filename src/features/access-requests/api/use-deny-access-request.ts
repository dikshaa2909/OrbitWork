import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface DenyAccessRequestPayload {
  requestId: string;
  workspaceId: string;
  reviewNote?: string;
}

export const useDenyAccessRequest = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ requestId, workspaceId, reviewNote }: DenyAccessRequestPayload) => {
      const response = await client.api["access-requests"][":requestId"]["deny"].$post({
        param: { requestId },
        json: { workspaceId, reviewNote },
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Failed to deny request");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.info("Access request denied");
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to deny request");
    },
  });

  return mutation;
};
