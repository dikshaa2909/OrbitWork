import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.projects[":projectId"]["members"][":memberId"]["$delete"], 200>;
type RequestType = InferRequestType<typeof client.api.projects[":projectId"]["members"][":memberId"]["$delete"]>;

export const useRemoveProjectMember = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param }) => {
      const response = await client.api.projects[":projectId"]["members"][":memberId"]["$delete"]({ param });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Failed to remove project member override");
      }

      return await response.json();
    },
    onSuccess: (_, { param }) => {
      toast.success("Project role override removed");
      queryClient.invalidateQueries({ queryKey: ["project-members", param.projectId] });
      queryClient.invalidateQueries({ queryKey: ["effective-permissions"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove project override");
    },
  });

  return mutation;
};
