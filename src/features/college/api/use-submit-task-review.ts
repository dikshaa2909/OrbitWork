import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.college.tasks)[":taskId"]["submit-review"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.college.tasks)[":taskId"]["submit-review"]["$post"]
>;

export const useSubmitTaskReview = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.college.tasks[":taskId"]["submit-review"].$post({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorData?.error || "Failed to submit task for review");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Task submitted to faculty guide for review");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["college-guide-pending-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["college-batch-overview"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit task for review");
    },
  });

  return mutation;
};

