import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client } from "@/lib/rpc";

interface UpdateTeamMemberRoleProps {
  param: {
    teamId: string;
    memberId: string;
  };
  json: {
    role: "LEAD" | "MEMBER";
  };
}

export const useUpdateTeamMemberRole = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ param, json }: UpdateTeamMemberRoleProps) => {
      const response = await client.api.college["teams"][":teamId"]["members"][":memberId"]["role"].$patch({
        param,
        json,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorData?.error || "Failed to update member role");
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.json.role === "LEAD"
          ? "Student promoted to Team Lead"
          : "Role updated to Member"
      );
      queryClient.invalidateQueries({ queryKey: ["college-guide-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["college-teams"] });
      queryClient.invalidateQueries({ queryKey: ["batch-overview"] });
      queryClient.invalidateQueries({ queryKey: ["college-persona"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update member role");
    },
  });

  return mutation;
};

