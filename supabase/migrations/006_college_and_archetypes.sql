-- ==============================================================================
-- 006 – Persona-Driven Workspace Archetype System & College Project Management
-- ==============================================================================

-- 1. Extend workspaces with type column
ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'STARTUP' CHECK (type IN ('STARTUP', 'COLLEGE'));

-- 2. Batches Table
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_batches_workspace ON public.batches(workspace_id);

-- 3. Academic Teams Table
CREATE TABLE IF NOT EXISTS public.academic_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
  team_code TEXT NOT NULL,
  title TEXT NOT NULL,
  abstract TEXT,
  lead_member_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_academic_teams_batch ON public.academic_teams(batch_id);

-- 4. Academic Team Members Table
CREATE TABLE IF NOT EXISTS public.academic_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.academic_teams(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('LEAD', 'MEMBER')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (team_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_academic_team_members_team ON public.academic_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_academic_team_members_member ON public.academic_team_members(member_id);

-- 5. Team Guides Table (Faculty guide assignments)
CREATE TABLE IF NOT EXISTS public.team_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.academic_teams(id) ON DELETE CASCADE,
  guide_member_id TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (team_id, guide_member_id)
);

CREATE INDEX IF NOT EXISTS idx_team_guides_team ON public.team_guides(team_id);
CREATE INDEX IF NOT EXISTS idx_team_guides_guide ON public.team_guides(guide_member_id);

-- 6. Milestones Table (Review Cycles)
CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  order_index INT NOT NULL DEFAULT 0,
  max_marks NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_milestones_batch ON public.milestones(batch_id, order_index);

-- 7. Submissions Table
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.academic_teams(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED')),
  notes TEXT,
  file_url TEXT,
  version INT NOT NULL DEFAULT 1,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  submitted_by TEXT NOT NULL,
  UNIQUE (milestone_id, team_id, version)
);

CREATE INDEX IF NOT EXISTS idx_submissions_milestone ON public.submissions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_submissions_team ON public.submissions(team_id);

-- 8. Rubrics Table
CREATE TABLE IF NOT EXISTS public.rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  total_weightage NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_rubrics_milestone ON public.rubrics(milestone_id);

-- 9. Rubric Criteria Table
CREATE TABLE IF NOT EXISTS public.rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES public.rubrics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  max_score NUMERIC NOT NULL DEFAULT 25,
  order_index INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric ON public.rubric_criteria(rubric_id, order_index);

-- 10. Evaluations Table (Grading records)
CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  evaluator_member_id TEXT NOT NULL,
  rubric_criteria_id UUID NOT NULL REFERENCES public.rubric_criteria(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (submission_id, evaluator_member_id, rubric_criteria_id)
);

CREATE INDEX IF NOT EXISTS idx_evaluations_submission ON public.evaluations(submission_id);

-- ------------------------------------------------------------------------------
-- Enable Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS Policies
-- ------------------------------------------------------------------------------

-- Batches: Visible to all workspace members
DROP POLICY IF EXISTS batches_select ON public.batches;
CREATE POLICY batches_select ON public.batches FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m."workspaceId" = batches.workspace_id AND m."userId" = auth.uid()::text
  )
);

-- Academic Teams: Visible to workspace members
DROP POLICY IF EXISTS academic_teams_select ON public.academic_teams;
CREATE POLICY academic_teams_select ON public.academic_teams FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.batches b
    JOIN public.members m ON m."workspaceId" = b.workspace_id
    WHERE b.id = academic_teams.batch_id AND m."userId" = auth.uid()::text
  )
);

-- Team Members & Guides
DROP POLICY IF EXISTS academic_team_members_select ON public.academic_team_members;
CREATE POLICY academic_team_members_select ON public.academic_team_members FOR SELECT USING (true);

DROP POLICY IF EXISTS team_guides_select ON public.team_guides;
CREATE POLICY team_guides_select ON public.team_guides FOR SELECT USING (true);

-- Milestones: Visible to workspace members in the batch
DROP POLICY IF EXISTS milestones_select ON public.milestones;
CREATE POLICY milestones_select ON public.milestones FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.batches b
    JOIN public.members m ON m."workspaceId" = b.workspace_id
    WHERE b.id = milestones.batch_id AND m."userId" = auth.uid()::text
  )
);

-- Submissions: Team members can view and insert their own team's submissions, assigned guides and admins can view
DROP POLICY IF EXISTS submissions_select ON public.submissions;
CREATE POLICY submissions_select ON public.submissions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.academic_team_members atm
    WHERE atm.team_id = submissions.team_id AND atm.member_id = auth.uid()::text
  )
  OR EXISTS (
    SELECT 1 FROM public.team_guides tg
    WHERE tg.team_id = submissions.team_id AND tg.guide_member_id = auth.uid()::text
  )
  OR EXISTS (
    SELECT 1 FROM public.academic_teams at
    JOIN public.batches b ON b.id = at.batch_id
    JOIN public.members m ON m."workspaceId" = b.workspace_id
    WHERE at.id = submissions.team_id AND m."userId" = auth.uid()::text AND m.role IN ('ADMIN', 'OWNER')
  )
);

DROP POLICY IF EXISTS submissions_insert ON public.submissions;
CREATE POLICY submissions_insert ON public.submissions FOR INSERT WITH CHECK (
  submitted_by = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.academic_team_members atm
    WHERE atm.team_id = submissions.team_id AND atm.member_id = auth.uid()::text
  )
);

-- Rubrics & Criteria: Visible to all
DROP POLICY IF EXISTS rubrics_select ON public.rubrics;
CREATE POLICY rubrics_select ON public.rubrics FOR SELECT USING (true);

DROP POLICY IF EXISTS rubric_criteria_select ON public.rubric_criteria;
CREATE POLICY rubric_criteria_select ON public.rubric_criteria FOR SELECT USING (true);

-- Evaluations: Visible to team members, evaluators, and admins
DROP POLICY IF EXISTS evaluations_select ON public.evaluations;
CREATE POLICY evaluations_select ON public.evaluations FOR SELECT USING (
  evaluator_member_id = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.academic_team_members atm ON atm.team_id = s.team_id
    WHERE s.id = evaluations.submission_id AND atm.member_id = auth.uid()::text
  )
  OR EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.academic_teams at ON at.id = s.team_id
    JOIN public.batches b ON b.id = at.batch_id
    JOIN public.members m ON m."workspaceId" = b.workspace_id
    WHERE s.id = evaluations.submission_id AND m."userId" = auth.uid()::text AND m.role IN ('ADMIN', 'OWNER')
  )
);

