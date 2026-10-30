import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.college.submissions)[":submissionId"]["grade"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.college.submissions)[":submissionId"]["grade"]["$post"]
>;

export const useGradeSubmission = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.college.submissions[":submissionId"].grade.$post({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorData?.error || "Failed to grade submission");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Evaluation recorded");
      queryClient.invalidateQueries({ queryKey: ["college-milestones"] });
      queryClient.invalidateQueries({ queryKey: ["college-submission-rubrics"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to record evaluation");
    },
  });

  return mutation;
};

