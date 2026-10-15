import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.roles["$post"], 200>;
type RequestType = InferRequestType<typeof client.api.roles["$post"]>;

export const useCreateRole = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json }) => {
      const response = await client.api.roles["$post"]({ json });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to create role");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Role created successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["effective-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["role-audit-logs"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create role");
    },
  });

  return mutation;
};
