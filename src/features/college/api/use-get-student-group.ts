import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetStudentGroupProps {
  workspaceId: string;
}

export const useGetStudentGroup = ({ workspaceId }: UseGetStudentGroupProps) => {
  const query = useQuery({
    queryKey: ["student-group", workspaceId],
    queryFn: async () => {
      const response = await client.api.college.student["my-group"].$get({
        query: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch student group");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!workspaceId,
  });

  return query;
};

