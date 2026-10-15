import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.sprints["$post"], 200>;
type RequestType = InferRequestType<typeof client.api.sprints["$post"]>;

export const useCreateSprint = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json }) => {
      const response = await client.api.sprints["$post"]({ json });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to create sprint");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Sprint created");
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create sprint");
    },
  });

  return mutation;
};
