import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface CreateAccessRequestPayload {
  workspaceId: string;
  permissionKey: string;
  resourceType?: string;
  resourceId?: string;
  duration?: "ONE_TIME" | "TIME_LIMITED" | "PERMANENT";
  reason?: string;
}

export const useCreateAccessRequest = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (json: CreateAccessRequestPayload) => {
      const response = await client.api["access-requests"].$post({ json });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Failed to submit access request");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Access request submitted to workspace admins");
      queryClient.invalidateQueries({ queryKey: ["access-requests", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["access-requests", "review"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to submit access request");
    },
  });

  return mutation;
};
