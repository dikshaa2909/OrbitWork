import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.college.batches)[":batchId"]["milestones"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.college.batches)[":batchId"]["milestones"]["$post"]
>;

export const useCreateMilestone = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.college.batches[":batchId"].milestones.$post({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorData?.error || "Failed to create milestone");
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Review milestone created");
      queryClient.invalidateQueries({
        queryKey: ["college-milestones", variables.param.batchId],
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create milestone");
    },
  });

  return mutation;
};

