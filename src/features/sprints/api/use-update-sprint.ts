import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.sprints)[":sprintId"]["$patch"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.sprints)[":sprintId"]["$patch"]
>;

export const useUpdateSprint = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.sprints[":sprintId"]["$patch"]({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to update sprint");
      }

      return await response.json();
    },
    onSuccess: ({ data }) => {
      toast.success("Sprint updated");
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
      queryClient.invalidateQueries({ queryKey: ["sprint", data.$id] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update sprint");
    },
  });

  return mutation;
};
