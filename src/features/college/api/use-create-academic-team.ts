import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.college.batches)[":batchId"]["teams"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.college.batches)[":batchId"]["teams"]["$post"]
>;

export const useCreateAcademicTeam = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.college.batches[":batchId"].teams.$post({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorData?.error || "Failed to create team");
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Project group created successfully");
      queryClient.invalidateQueries({
        queryKey: ["college-teams", variables.param.batchId],
      });
      queryClient.invalidateQueries({
        queryKey: ["college-guide-dashboard"],
      });
      queryClient.invalidateQueries({
        queryKey: ["college-guide-groups"],
      });
      queryClient.invalidateQueries({
        queryKey: ["batch-overview"],
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to register team");
    },
  });

  return mutation;
};

