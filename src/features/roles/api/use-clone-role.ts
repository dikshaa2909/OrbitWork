import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.roles[":roleId"]["clone"]["$post"], 200>;
type RequestType = InferRequestType<typeof client.api.roles[":roleId"]["clone"]["$post"]>;

export const useCloneRole = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.roles[":roleId"]["clone"]["$post"]({ param, json });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to clone role");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Role cloned successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-audit-logs"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to clone role");
    },
  });

  return mutation;
};
