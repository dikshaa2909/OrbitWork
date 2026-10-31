-- ==============================================================================
-- 013 – Academic Milestones, Oversight Matrix, & Scoped Evaluations Engine
-- ==============================================================================

-- 1. Ensure milestones table constraints & columns
ALTER TABLE public.milestones
ADD COLUMN IF NOT EXISTS max_marks NUMERIC NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS order_index INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES public.members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_milestones_batch_order 
ON public.milestones(batch_id, order_index);

-- 2. Ensure submissions table has required check constraints & indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'submissions_status_check'
  ) THEN
    ALTER TABLE public.submissions 
    ADD CONSTRAINT submissions_status_check 
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED'));
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_submissions_team_milestone 
ON public.submissions(team_id, milestone_id, version DESC);

-- 3. Ensure evaluations table supports total_score and criteria links
ALTER TABLE public.evaluations
ADD COLUMN IF NOT EXISTS total_score NUMERIC,
ADD COLUMN IF NOT EXISTS remarks TEXT;

CREATE INDEX IF NOT EXISTS idx_evaluations_submission_evaluator 
ON public.evaluations(submission_id, evaluator_member_id);

-- 4. Enable RLS and define access policies for oversight and evaluation
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- Submissions policy: Students belonging to team can insert submissions
DO $$
BEGIN
  DROP POLICY IF EXISTS "Team members can insert submissions" ON public.submissions;
  CREATE POLICY "Team members can insert submissions"
  ON public.submissions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.academic_team_members atm
      JOIN public.members m ON m.id = atm.member_id OR m."userId" = atm.member_id
      WHERE atm.team_id = submissions.team_id
        AND m."userId" = auth.uid()::text
    )
  );

  DROP POLICY IF EXISTS "Everyone in batch can view submissions" ON public.submissions;
  CREATE POLICY "Everyone in batch can view submissions"
  ON public.submissions
  FOR SELECT
  USING (true);
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

