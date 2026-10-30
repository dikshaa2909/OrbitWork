-- ==============================================================================
-- 008 – Indian College Capstone Hierarchy Engine & Task Review Gatekeeper
-- ==============================================================================

-- 1. Extend tasks table with review verification fields
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'NOT_SUBMITTED' 
  CHECK (verification_status IN ('NOT_SUBMITTED', 'PENDING_GUIDE_REVIEW', 'CHANGES_REQUESTED', 'APPROVED')),
ADD COLUMN IF NOT EXISTS guide_feedback TEXT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_by TEXT REFERENCES public.members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_verification_status ON public.tasks(verification_status);
CREATE INDEX IF NOT EXISTS idx_tasks_verified_by ON public.tasks(verified_by);

-- 2. Progress View / RPC for Batch Groups Monitoring
CREATE OR REPLACE FUNCTION public.get_batch_groups_progress(p_batch_id UUID)
RETURNS TABLE (
  team_id UUID,
  team_code TEXT,
  project_title TEXT,
  project_id TEXT,
  lead_name TEXT,
  lead_member_id TEXT,
  guide_name TEXT,
  guide_id TEXT,
  total_tasks BIGINT,
  completed_tasks BIGINT,
  pending_review_tasks BIGINT,
  progress_percentage NUMERIC,
  latest_activity_timestamp TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT 
    at.id AS team_id,
    at.team_code,
    at.title AS project_title,
    at.project_id,
    COALESCE(lead_u.raw_user_meta_data->>'name', lead_u.email, 'Lead') AS lead_name,
    at.lead_member_id,
    COALESCE(guide_u.raw_user_meta_data->>'name', guide_u.email, 'Not Assigned') AS guide_name,
    tg.guide_member_id AS guide_id,
    COUNT(t.id)::BIGINT AS total_tasks,
    COUNT(CASE WHEN t.status = 'DONE' OR t.verification_status = 'APPROVED' THEN 1 END)::BIGINT AS completed_tasks,
    COUNT(CASE WHEN t.verification_status = 'PENDING_GUIDE_REVIEW' OR t.status = 'IN_REVIEW' THEN 1 END)::BIGINT AS pending_review_tasks,
    ROUND(
      COALESCE(
        (COUNT(CASE WHEN t.status = 'DONE' OR t.verification_status = 'APPROVED' THEN 1 END)::numeric / NULLIF(COUNT(t.id), 0)) * 100,
        0
      ),
      1
    ) AS progress_percentage,
    MAX(COALESCE(t.updated_at, at.updated_at)) AS latest_activity_timestamp
  FROM public.academic_teams at
  LEFT JOIN public.members lead_m ON (lead_m.id = at.lead_member_id OR lead_m."userId" = at.lead_member_id)
  LEFT JOIN auth.users lead_u ON (lead_u.id::text = lead_m."userId" OR lead_u.id::text = at.lead_member_id)
  LEFT JOIN public.team_guides tg ON tg.team_id = at.id
  LEFT JOIN public.members guide_m ON (guide_m.id = tg.guide_member_id OR guide_m."userId" = tg.guide_member_id)
  LEFT JOIN auth.users guide_u ON (guide_u.id::text = guide_m."userId" OR guide_u.id::text = tg.guide_member_id)
  LEFT JOIN public.tasks t ON t."projectId" = at.project_id
  WHERE at.batch_id = p_batch_id
  GROUP BY 
    at.id, 
    at.team_code, 
    at.title, 
    at.project_id, 
    lead_u.raw_user_meta_data, 
    lead_u.email, 
    at.lead_member_id, 
    guide_u.raw_user_meta_data, 
    guide_u.email, 
    tg.guide_member_id
  ORDER BY at.team_code ASC;
$$;
