import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.tasks)[":taskId"]["comments"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.tasks)[":taskId"]["comments"]["$post"]
>;

export const useCreateComment = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.tasks[":taskId"]["comments"].$post({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to post comment");
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Comment added");
      queryClient.invalidateQueries({
        queryKey: ["comments", variables.param.taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["activity", variables.param.taskId],
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to post comment");
    },
  });

  return mutation;
};
