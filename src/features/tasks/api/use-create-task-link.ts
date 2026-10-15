import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.tasks)[":taskId"]["links"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.tasks)[":taskId"]["links"]["$post"]
>;

export const useCreateTaskLink = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.tasks[":taskId"]["links"].$post({
        param,
        json,
      });

      if (!response.ok) {
        throw new Error("Failed to link task");
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Task linked");
      queryClient.invalidateQueries({
        queryKey: ["task-links", variables.param.taskId],
      });
    },
    onError: () => {
      toast.error("Failed to link task");
    },
  });

  return mutation;
};
