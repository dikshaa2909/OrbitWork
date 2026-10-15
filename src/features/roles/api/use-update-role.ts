import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.roles[":roleId"]["$patch"], 200>;
type RequestType = InferRequestType<typeof client.api.roles[":roleId"]["$patch"]>;

export const useUpdateRole = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json, param }) => {
      const response = await client.api.roles[":roleId"]["$patch"]({ json, param });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to update role");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Role updated successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["effective-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["role-audit-logs"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  return mutation;
};
