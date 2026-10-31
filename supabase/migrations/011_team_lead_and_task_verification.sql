-- ==============================================================================
-- 011 – Team Lead Promotion & Student Task Verification Lifecycle Engine
-- ==============================================================================

-- 1. Ensure academic_team_members has updated_at column to avoid PostgREST cache errors
ALTER TABLE public.academic_team_members
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS idx_academic_team_members_team_role 
ON public.academic_team_members(team_id, role);

-- 2. Extend tasks table with student submission proof and verification gate fields
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS submission_notes TEXT,
ADD COLUMN IF NOT EXISTS submission_file_url TEXT,
ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'IN_PROGRESS'
  CHECK (review_status IN ('TODO', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'APPROVED')),
ADD COLUMN IF NOT EXISTS reviewer_feedback TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES public.members(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_review_status ON public.tasks(review_status);
CREATE INDEX IF NOT EXISTS idx_tasks_submitted_for_review ON public.tasks(submitted_for_review_at);

-- 3. Atomic Team Lead Promotion Function
CREATE OR REPLACE FUNCTION public.promote_team_lead(
  p_team_id UUID,
  p_student_member_id TEXT,
  p_actor_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_team RECORD;
  v_batch RECORD;
  v_is_guide BOOLEAN := FALSE;
  v_is_admin BOOLEAN := FALSE;
  v_member_exists BOOLEAN := FALSE;
BEGIN
  -- 1. Find team
  SELECT * INTO v_team FROM public.academic_teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- 2. Find batch
  SELECT * INTO v_batch FROM public.batches WHERE id = v_team.batch_id;

  -- 3. Check actor authorization (either assigned guide in team_guides OR workspace admin/owner)
  SELECT EXISTS (
    SELECT 1 FROM public.team_guides 
    WHERE team_id = p_team_id AND (guide_member_id = p_actor_id OR guide_member_id IN (
      SELECT id FROM public.members WHERE "userId" = p_actor_id
    ))
  ) INTO v_is_guide;

  SELECT EXISTS (
    SELECT 1 FROM public.members m
    LEFT JOIN public.roles r ON r.id = m."roleId"
    WHERE (m.id = p_actor_id OR m."userId" = p_actor_id)
      AND m."workspaceId" = v_batch.workspace_id
      AND (m.role = 'ADMIN' OR COALESCE(r.level, 100) <= 10)
  ) INTO v_is_admin;

  -- Check workspace owner
  IF NOT v_is_admin THEN
    SELECT EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = v_batch.workspace_id AND w."userId" = p_actor_id
    ) INTO v_is_admin;
  END IF;

  IF NOT v_is_guide AND NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the assigned Faculty Guide or HOD can assign team lead');
  END IF;

  -- 4. Check if student is in the team
  SELECT EXISTS (
    SELECT 1 FROM public.academic_team_members
    WHERE team_id = p_team_id AND member_id = p_student_member_id
  ) INTO v_member_exists;

  IF NOT v_member_exists THEN
    INSERT INTO public.academic_team_members (team_id, member_id, role)
    VALUES (p_team_id, p_student_member_id, 'LEAD')
    ON CONFLICT (team_id, member_id) DO UPDATE SET role = 'LEAD', updated_at = now();
  ELSE
    -- Demote other members of this team to MEMBER
    UPDATE public.academic_team_members
    SET role = 'MEMBER', updated_at = now()
    WHERE team_id = p_team_id AND member_id != p_student_member_id;

    -- Promote target member to LEAD
    UPDATE public.academic_team_members
    SET role = 'LEAD', updated_at = now()
    WHERE team_id = p_team_id AND member_id = p_student_member_id;
  END IF;

  -- 5. Update academic_teams lead_member_id
  UPDATE public.academic_teams
  SET lead_member_id = p_student_member_id, updated_at = now()
  WHERE id = p_team_id;

  RETURN jsonb_build_object(
    'success', true,
    'team_id', p_team_id,
    'lead_member_id', p_student_member_id
  );
END;
$$;

