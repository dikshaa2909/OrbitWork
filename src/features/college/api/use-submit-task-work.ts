import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

interface SubmitTaskWorkProps {
  param: {
    taskId: string;
  };
  json: {
    submissionNotes: string;
    submissionFileUrl?: string;
  };
}

export const useSubmitTaskWork = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ param, json }: SubmitTaskWorkProps) => {
      const response = await client.api.college.tasks[":taskId"]["submit-work"].$post({
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
      toast.success("Task work submitted to faculty guide for sign-off");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["college-student-group"] });
      queryClient.invalidateQueries({ queryKey: ["college-guide-pending-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["college-guide-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["college-batch-overview"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to submit task for review");
    },
  });

  return mutation;
};

