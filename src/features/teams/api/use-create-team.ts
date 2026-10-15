import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.teams["$post"], 200>;
type RequestType = InferRequestType<typeof client.api.teams["$post"]>;

export const useCreateTeam = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json }) => {
      const response = await client.api.teams["$post"]({ json });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to create team");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Team created successfully");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["hierarchy"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create team");
    },
  });

  return mutation;
};
