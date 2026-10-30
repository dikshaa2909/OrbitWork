import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.college.tasks)[":taskId"]["verify"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.college.tasks)[":taskId"]["verify"]["$post"]
>;

export const useVerifyTask = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.college.tasks[":taskId"].verify.$post({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorData?.error || "Failed to submit verification decision");
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      const decision = variables.json.decision;
      toast.success(
        decision === "APPROVED"
          ? "Task verified and approved into Done"
          : "Changes requested from student team"
      );
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["college-guide-pending-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["college-batch-overview"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit verification decision");
    },
  });

  return mutation;
};

