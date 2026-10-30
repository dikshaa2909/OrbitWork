import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { Submission, Rubric, RubricCriteria } from "../types";

export interface SubmissionRubricsResponse {
  submission: Submission;
  rubrics: (Rubric & {
    criteria: (RubricCriteria & {
      current_score: number | null;
      feedback: string | null;
    })[];
  })[];
}

interface UseGetSubmissionRubricsProps {
  submissionId?: string | null;
}

export const useGetSubmissionRubrics = ({
  submissionId,
}: UseGetSubmissionRubricsProps = {}) => {
  const query = useQuery({
    enabled: !!submissionId,
    queryKey: ["college-submission-rubrics", submissionId],
    queryFn: async () => {
      if (!submissionId) return null;

      const response = await client.api.college.submissions[":submissionId"].rubrics.$get({
        param: { submissionId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch submission rubrics");
      }

      const { data } = await response.json();
      return data as SubmissionRubricsResponse;
    },
  });

  return query;
};

