/**
 * College Academic Capstone Utilities
 * Centralized group progress, status metrics, and countdown calculations.
 */

export interface GroupProgressResult {
  totalTasks: number;
  completedTasks: number;
  pendingReviewTasks: number;
  progressPercentage: number;
  statusText: string;
  isCompleted: boolean;
  needsAttention: boolean;
}

/**
 * Calculates academic team task and deliverable progress.
 * Consolidates status calculations to eliminate code duplication across HOD, Guide, and Student views.
 */
export function getGroupProgress(team: {
  total_tasks?: number | string | null;
  completed_tasks?: number | string | null;
  pending_review_tasks?: number | string | null;
  progress_percentage?: number | string | null;
  tasks?: Array<{ status?: string; verification_status?: string }>;
  guide_id?: string | null;
  guide_name?: string | null;
}): GroupProgressResult {
  let total = Number(team.total_tasks || 0);
  let completed = Number(team.completed_tasks || 0);
  let pending = Number(team.pending_review_tasks || 0);

  if (Array.isArray(team.tasks) && team.tasks.length > 0) {
    total = team.tasks.length;
    completed = team.tasks.filter(
      (t) => t.status === "DONE" || t.verification_status === "APPROVED"
    ).length;
    pending = team.tasks.filter(
      (t) => t.verification_status === "PENDING_GUIDE_REVIEW" || t.status === "IN_REVIEW"
    ).length;
  }

  const percentage =
    team.progress_percentage !== undefined && team.progress_percentage !== null
      ? Math.min(100, Math.max(0, Math.round(Number(team.progress_percentage))))
      : total > 0
      ? Math.round((completed / total) * 100)
      : 0;

  const needsAttention =
    pending > 2 ||
    !team.guide_id ||
    team.guide_name === "Not Assigned" ||
    team.guide_name === "Not Assigned (Open Pool)";

  let statusText = "On Track";
  if (percentage === 100 && total > 0) {
    statusText = "Completed";
  } else if (needsAttention) {
    statusText = pending > 2 ? "Review Backlog" : "No Guide Assigned";
  } else if (pending > 0) {
    statusText = "Awaiting Verification";
  } else if (total === 0) {
    statusText = "Not Started";
  }

  return {
    totalTasks: total,
    completedTasks: completed,
    pendingReviewTasks: pending,
    progressPercentage: percentage,
    statusText,
    isCompleted: percentage === 100 && total > 0,
    needsAttention,
  };
}

/**
 * Calculates human-readable countdown string to a milestone deadline.
 */
export function getMilestoneCountdown(dueDateStr?: string | null): {
  daysLeft: number;
  formatted: string;
  isOverdue: boolean;
} {
  if (!dueDateStr) {
    return { daysLeft: 0, formatted: "Date TBA", isOverdue: false };
  }

  const due = new Date(dueDateStr).getTime();
  const now = Date.now();
  const diffMs = due - now;
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return {
      daysLeft,
      formatted: `${Math.abs(daysLeft)}d overdue`,
      isOverdue: true,
    };
  }
  if (daysLeft === 0) {
    return { daysLeft: 0, formatted: "Due Today", isOverdue: false };
  }
  if (daysLeft === 1) {
    return { daysLeft: 1, formatted: "1 day left", isOverdue: false };
  }
  return {
    daysLeft,
    formatted: `${daysLeft} days left`,
    isOverdue: false,
  };
}

export type MilestoneStatusVariant = "success" | "warning" | "destructive" | "secondary";

export interface ResolvedMilestoneStatus {
  status: "APPROVED" | "PENDING_REVIEW" | "CHANGES_REQUESTED" | "OVERDUE" | "UPCOMING";
  label: string;
  variant: MilestoneStatusVariant;
  formattedCountdown?: string;
  score?: number | null;
  maxMarks?: number;
}

/**
 * Standardized Milestone Status Resolution.
 * Priority sequence:
 * 1. APPROVED -> 'Approved' (or 'Approved (X/Y)'), variant: success
 * 2. SUBMITTED / UNDER_REVIEW -> 'Under Guide Review', variant: warning
 * 3. CHANGES_REQUESTED -> 'Changes Requested', variant: destructive
 * 4. OVERDUE -> Only if no submission / DRAFT and due date is past, variant: destructive
 * 5. UPCOMING -> 'Upcoming' / countdown, variant: secondary
 */
export function resolveMilestoneStatus(
  milestone?: { due_date?: string | null; max_marks?: number | null } | null,
  submission?: { status?: string | null; total_score?: number | null } | null
): ResolvedMilestoneStatus {
  const maxMarks = Number(milestone?.max_marks) || 100;

  // Step 1: Approved
  if (submission?.status === "APPROVED") {
    const hasScore = submission.total_score !== undefined && submission.total_score !== null;
    return {
      status: "APPROVED",
      label: hasScore ? `Approved (${submission.total_score}/${maxMarks})` : "Approved",
      variant: "success",
      score: submission.total_score,
      maxMarks,
    };
  }

  // Step 2: Under guide review / submitted
  if (submission?.status === "SUBMITTED" || submission?.status === "UNDER_REVIEW") {
    return {
      status: "PENDING_REVIEW",
      label: "Under Guide Review",
      variant: "warning",
    };
  }

  // Step 3: Changes requested
  if (submission?.status === "CHANGES_REQUESTED") {
    return {
      status: "CHANGES_REQUESTED",
      label: "Changes Requested",
      variant: "destructive",
    };
  }

  // Step 4: Overdue check (only when no submission or status is DRAFT)
  if (milestone?.due_date) {
    const dueTime = new Date(milestone.due_date).getTime();
    const now = Date.now();

    if (dueTime < now) {
      const daysOverdue = Math.max(1, Math.ceil((now - dueTime) / (1000 * 60 * 60 * 24)));
      return {
        status: "OVERDUE",
        label: `${daysOverdue}d overdue`,
        variant: "destructive",
        formattedCountdown: `${daysOverdue}d overdue`,
      };
    }

    const daysLeft = Math.ceil((dueTime - now) / (1000 * 60 * 60 * 24));
    const countdownText = daysLeft === 0 ? "Due Today" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`;
    return {
      status: "UPCOMING",
      label: countdownText,
      variant: "secondary",
      formattedCountdown: countdownText,
    };
  }

  return {
    status: "UPCOMING",
    label: "Upcoming",
    variant: "secondary",
  };
}
