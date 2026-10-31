import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

interface RemoveTeamMemberProps {
  param: {
    teamId: string;
    memberId: string;
  };
}

export const useRemoveTeamMember = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ param }: RemoveTeamMemberProps) => {
      const response = await client.api.college["teams"][":teamId"]["members"][":memberId"].$delete({
        param,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorData?.error || "Failed to remove member");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Student removed from group");
      queryClient.invalidateQueries({ queryKey: ["college-guide-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["college-teams"] });
      queryClient.invalidateQueries({ queryKey: ["batch-overview"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove student");
    },
  });

  return mutation;
};

