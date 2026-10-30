import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { AcademicTeam } from "../types";

interface UseGetGuideGroupsProps {
  workspaceId?: string;
}

export const useGetGuideGroups = ({ workspaceId }: UseGetGuideGroupsProps = {}) => {
  const query = useQuery({
    enabled: !!workspaceId,
    queryKey: ["college-guide-groups", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      const response = await client.api.college.guide["my-groups"].$get({
        query: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch assigned guide groups");
      }

      const { data } = await response.json();
      return data as AcademicTeam[];
    },
  });

  return query;
};

