import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<
  (typeof client.api.college.teams)[":teamId"]["assign-guide"]["$post"],
  200
>;
type RequestType = InferRequestType<
  (typeof client.api.college.teams)[":teamId"]["assign-guide"]["$post"]
>;

export const useAssignGuide = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.college.teams[":teamId"]["assign-guide"].$post({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorData?.error || "Failed to assign guide");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Faculty guide assigned");
      queryClient.invalidateQueries({ queryKey: ["college-teams"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to assign guide");
    },
  });

  return mutation;
};

