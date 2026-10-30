import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.chat.channels.$post, 200>;
type RequestType = InferRequestType<typeof client.api.chat.channels.$post>;

export const useCreateChannel = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json }) => {
      const response = await client.api.chat.channels.$post({ json });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorData?.error || "Failed to create channel");
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Channel created");
      queryClient.invalidateQueries({
        queryKey: ["chat-channels", variables.json.workspaceId],
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create channel");
    },
  });

  return mutation;
};

