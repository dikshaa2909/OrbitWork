import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.chat.channels)[":channelId"]["messages"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.chat.channels)[":channelId"]["messages"]["$post"]
>;

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.chat.channels[":channelId"].messages.$post({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorData?.error || "Failed to send message");
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["chat-messages", variables.param.channelId],
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send message");
    },
  });

  return mutation;
};

