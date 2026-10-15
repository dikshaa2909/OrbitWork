import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { Member } from "@/features/members/types";

export const useGetTeamMembers = (teamId?: string) => {
  return useQuery({
    enabled: !!teamId,
    queryKey: ["team-members", teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const res = await client.api.teams[":teamId"]["members"].$get({
        param: { teamId },
      });
      if (!res.ok) throw new Error("Failed to fetch team members");
      const { data } = await res.json();
      return data as Member[];
    },
  });
};

export const useAddTeamMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, memberId }: { teamId: string; memberId: string }) => {
      const res = await client.api.teams[":teamId"]["members"].$post({
        param: { teamId },
        json: { memberId },
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Failed to add team member");
      }
      return await res.json();
    },
    onSuccess: (_, { teamId }) => {
      toast.success("Member added to team");
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["hierarchy"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add member to team");
    },
  });
};

export const useRemoveTeamMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, memberId }: { teamId: string; memberId: string }) => {
      const res = await client.api.teams[":teamId"]["members"][":memberId"].$delete({
        param: { teamId, memberId },
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Failed to remove member from team");
      }
      return await res.json();
    },
    onSuccess: (_, { teamId }) => {
      toast.success("Member removed from team");
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["hierarchy"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to remove member from team");
    },
  });
};
