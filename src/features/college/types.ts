import { z } from "zod";

export interface Batch {
  id: string;
  workspace_id: string;
  name: string;
  department: string;
  academic_year: string;
  created_at: string;
  updated_at: string;
  // Joined stats
  teams_count?: number;
  milestones_count?: number;
}

export interface AcademicTeam {
  id: string;
  batch_id: string;
  project_id: string | null;
  team_code: string;
  title: string;
  abstract: string | null;
  lead_member_id: string;
  created_at: string;
  updated_at: string;
  // Joined stats
  lead_name?: string;
  lead_email?: string;
  members?: AcademicTeamMember[];
  guides?: TeamGuide[];
}

export interface AcademicTeamMember {
  id: string;
  team_id: string;
  member_id: string;
  role: "LEAD" | "MEMBER";
  joined_at: string;
  name?: string;
  email?: string;
}

export interface TeamGuide {
  id: string;
  team_id: string;
  guide_member_id: string;
  assigned_at: string;
  name?: string;
  email?: string;
}

export interface Milestone {
  id: string;
  batch_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  order_index: number;
  max_marks: number;
  created_at: string;
  // Joined
  submissions_count?: number;
  rubrics?: Rubric[];
  my_submission?: Submission | null;
}

export interface Submission {
  id: string;
  milestone_id: string;
  team_id: string;
  status: "DRAFT" | "SUBMITTED" | "CHANGES_REQUESTED" | "APPROVED";
  notes: string | null;
  file_url: string | null;
  version: number;
  submitted_at: string;
  submitted_by: string;
  // Joined
  team_title?: string;
  team_code?: string;
  evaluations?: Evaluation[];
  total_score?: number;
}

export interface Rubric {
  id: string;
  milestone_id: string;
  title: string;
  total_weightage: number;
  created_at: string;
  criteria?: RubricCriteria[];
}

export interface RubricCriteria {
  id: string;
  rubric_id: string;
  title: string;
  description: string | null;
  max_score: number;
  order_index: number;
  current_score?: number | null;
  feedback?: string | null;
}

export interface Evaluation {
  id: string;
  submission_id: string;
  evaluator_member_id: string;
  rubric_criteria_id: string;
  score: number;
  feedback: string | null;
  created_at: string;
}

export interface BatchGroupProgress {
  team_id: string;
  team_code: string;
  project_title: string;
  project_id: string | null;
  lead_name: string;
  lead_member_id: string;
  guide_name: string;
  guide_id: string | null;
  total_tasks: number;
  completed_tasks: number;
  pending_review_tasks: number;
  progress_percentage: number;
  latest_activity_timestamp: string;
}

export interface GuideTaskVerificationItem {
  id: string;
  name: string;
  status: string;
  verification_status: "NOT_SUBMITTED" | "PENDING_GUIDE_REVIEW" | "CHANGES_REQUESTED" | "APPROVED";
  guide_feedback?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  due_date: string;
  team_id: string;
  team_code: string;
  team_title: string;
  assignee_name?: string;
}

// Zod Schemas
export const createBatchSchema = z.object({
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
  name: z.string().trim().min(1, "Batch name is required"),
  department: z.string().trim().min(1, "Department is required"),
  academicYear: z.string().trim().min(1, "Academic year is required"),
});

export const createAcademicTeamSchema = z.object({
  batchId: z.string().trim().optional(),
  teamCode: z.string().trim().min(1, "Team code is required"),
  title: z.string().trim().min(1, "Project title is required"),
  abstract: z.string().optional(),
  leadMemberId: z.string().trim().optional(),
  memberIds: z.array(z.string()).default([]),
  guideMemberId: z.string().optional(),
});

export const assignGuideSchema = z.object({
  guideMemberId: z.string().trim().min(1, "Guide member ID is required"),
});

export const createMilestoneSchema = z.object({
  batchId: z.string().trim().min(1, "Batch ID is required"),
  title: z.string().trim().min(1, "Milestone title is required"),
  description: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  orderIndex: z.number().int().default(0),
  maxMarks: z.number().min(1).default(100),
  criteria: z
    .array(
      z.object({
        title: z.string().min(1, "Criteria title required"),
        description: z.string().optional(),
        maxScore: z.number().min(1),
      })
    )
    .optional(),
});

export const createSubmissionSchema = z.object({
  teamId: z.string().trim().min(1, "Team ID is required"),
  notes: z.string().optional(),
  fileUrl: z.string().trim().min(1, "File / Link URL is required"),
});

export const gradeSubmissionSchema = z.object({
  grades: z.array(
    z.object({
      rubricCriteriaId: z.string().trim().min(1),
      score: z.number().min(0),
      feedback: z.string().optional(),
    })
  ),
  status: z
    .enum(["SUBMITTED", "CHANGES_REQUESTED", "APPROVED"])
    .default("APPROVED"),
});

export const verifyTaskSchema = z.object({
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
  feedback: z.string().optional(),
});

export const submitTaskReviewSchema = z.object({
  notes: z.string().optional(),
});
