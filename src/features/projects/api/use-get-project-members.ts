import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { Member } from "@/features/members/types";
import { Role } from "@/features/roles/types";

interface UseGetProjectMembersProps {
  projectId?: string;
}

export interface ProjectMemberOverride {
  id: string;
  projectId: string;
  memberId: string;
  roleId: string | null;
  created_at: string;
  member?: Member | null;
  role?: Role | null;
}

export const useGetProjectMembers = ({ projectId }: UseGetProjectMembersProps = {}) => {
  const query = useQuery({
    enabled: !!projectId,
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const response = await client.api.projects[":projectId"]["members"].$get({
        param: { projectId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch project members");
      }

      const { data } = await response.json();
      return data as ProjectMemberOverride[];
    },
  });

  return query;
};
