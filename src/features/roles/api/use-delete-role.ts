import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.roles[":roleId"]["$delete"], 200>;
type RequestType = InferRequestType<typeof client.api.roles[":roleId"]["$delete"]>;

export const useDeleteRole = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, query }) => {
      const response = await client.api.roles[":roleId"]["$delete"]({ param, query });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to delete role");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Role deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["effective-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["role-audit-logs"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete role");
    },
  });

  return mutation;
};
