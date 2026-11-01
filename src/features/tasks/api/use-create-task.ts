import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/rpc";

type ResponseType = InferResponseType<typeof client.api.tasks["$post"], 200>;
type RequestType = InferRequestType<typeof client.api.tasks["$post"]>;

export const useCreateTask = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    ResponseType,
    Error,
    RequestType
  >({
    mutationFn: async ({ json }) => {
      const response = await client.api.tasks["$post"]({ json });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string | { issues?: Array<{ path?: (string | number)[]; message: string }> };
          message?: string;
        } | null;
        const message =
          typeof errorData?.error === "string"
            ? errorData.error
            : typeof errorData?.error === "object" && errorData.error?.issues?.[0]?.message
            ? `${errorData.error.issues[0].path?.join(".") || "Field"}: ${errorData.error.issues[0].message}`
            : errorData?.message || "Failed to create task";
        throw new Error(message);
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Task created");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create task");
    }
  });

  return mutation;
};
