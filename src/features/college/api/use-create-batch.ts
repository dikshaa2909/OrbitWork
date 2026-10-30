import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.college.workspaces)[":workspaceId"]["batches"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.college.workspaces)[":workspaceId"]["batches"]["$post"]
>;

export const useCreateBatch = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.college.workspaces[":workspaceId"].batches.$post({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorData?.error || "Failed to create batch");
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Academic batch created");
      queryClient.invalidateQueries({
        queryKey: ["college-batches", variables.param.workspaceId],
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create batch");
    },
  });

  return mutation;
};

