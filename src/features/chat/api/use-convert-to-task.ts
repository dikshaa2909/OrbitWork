import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.chat.messages)[":messageId"]["convert-to-task"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.chat.messages)[":messageId"]["convert-to-task"]["$post"]
>;

export const useConvertToTask = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.chat.messages[":messageId"]["convert-to-task"].$post({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorData?.error || "Failed to convert to task");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Task created from message");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to convert message to task");
    },
  });

  return mutation;
};

