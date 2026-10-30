import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.college.milestones)[":milestoneId"]["submit"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.college.milestones)[":milestoneId"]["submit"]["$post"]
>;

export const useSubmitMilestone = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.college.milestones[":milestoneId"].submit.$post({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorData?.error || "Failed to submit milestone");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Deliverable submitted for review");
      queryClient.invalidateQueries({ queryKey: ["college-milestones"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit milestone");
    },
  });

  return mutation;
};

