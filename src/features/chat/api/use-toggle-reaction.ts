import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.chat.messages)[":messageId"]["reactions"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.chat.messages)[":messageId"]["reactions"]["$post"]
>;

export const useToggleReaction = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.chat.messages[":messageId"].reactions.$post({
        param,
        json,
      });

      if (!response.ok) {
        throw new Error("Failed to toggle reaction");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["chat-messages"],
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add reaction");
    },
  });

  return mutation;
};

