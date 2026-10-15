import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

interface UseTransferOwnershipProps {
  param: {
    workspaceId: string;
  };
  json: {
    targetMemberId: string;
  };
}

export const useTransferOwnership = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    { success: boolean; message: string },
    Error,
    UseTransferOwnershipProps
  >({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.workspaces[":workspaceId"]["transfer-ownership"].$post({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          (errorData as { error?: string })?.error || "Failed to transfer ownership"
        );
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Workspace ownership transferred");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["workspace", variables.param.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["members", variables.param.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["current-member", variables.param.workspaceId] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to transfer ownership");
    },
  });

  return mutation;
};
