import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.tasks)["workspace-labels"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.tasks)["workspace-labels"]["$post"]
>;

export const useCreateLabel = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json }) => {
      const response = await client.api.tasks["workspace-labels"].$post({
        json,
      });

      if (!response.ok) {
        throw new Error("Failed to create label");
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Label created");
      queryClient.invalidateQueries({
        queryKey: ["labels", variables.json.workspaceId],
      });
    },
    onError: () => {
      toast.error("Failed to create label");
    },
  });

  return mutation;
};
