import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.sprints)[":sprintId"]["$delete"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.sprints)[":sprintId"]["$delete"]
>;

export const useDeleteSprint = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param }) => {
      const response = await client.api.sprints[":sprintId"]["$delete"]({
        param,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to delete sprint");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Sprint deleted");
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete sprint");
    },
  });

  return mutation;
};
