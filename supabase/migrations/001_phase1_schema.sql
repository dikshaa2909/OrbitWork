-- ==============================================================================
-- PHASE 1: JIRA CORE PARITY SCHEMA MIGRATION
-- ==============================================================================
-- Migration: 001_phase1_schema.sql
-- Covers: Expanded roles, task hierarchy & details, sprints, labels, comments,
-- attachments, activity logs, task links, notifications, saved filters, audit logs,
-- workflows, and comprehensive Row Level Security (RLS) policies.
-- ==============================================================================

-- 1. Helper Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Update Members Role Constraint
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_role_check;
ALTER TABLE public.members ADD CONSTRAINT members_role_check 
  CHECK (role IN ('OWNER', 'ADMIN', 'PROJECT_MANAGER', 'MEMBER', 'VIEWER', 'GUEST'));

-- 3. Expand Tasks Table
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'TASK' 
    CHECK (type IN ('TASK', 'BUG', 'STORY', 'EPIC', 'SUBTASK')),
  ADD COLUMN IF NOT EXISTS "parentId" TEXT REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'MEDIUM' 
    CHECK (priority IN ('URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE')),
  ADD COLUMN IF NOT EXISTS "reporterId" TEXT REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "storyPoints" INTEGER,
  ADD COLUMN IF NOT EXISTS "estimatedHours" NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS "sprintId" TEXT;

-- Backfill reporterId on existing tasks safely from assigneeId or first workspace admin
UPDATE public.tasks 
SET "reporterId" = "assigneeId" 
WHERE "reporterId" IS NULL AND "assigneeId" IS NOT NULL;

UPDATE public.tasks t
SET "reporterId" = (
  SELECT m.id FROM public.members m 
  WHERE m."workspaceId" = t."workspaceId" 
  ORDER BY CASE WHEN m.role IN ('OWNER', 'ADMIN') THEN 1 ELSE 2 END, m.created_at ASC 
  LIMIT 1
)
WHERE t."reporterId" IS NULL;

-- 4. Create Sprints Table
CREATE TABLE IF NOT EXISTS public.sprints (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  "projectId" TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PLANNING' CHECK (status IN ('PLANNING', 'ACTIVE', 'COMPLETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Add foreign key constraint from tasks to sprints if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_tasks_sprint'
  ) THEN
    ALTER TABLE public.tasks 
      ADD CONSTRAINT fk_tasks_sprint FOREIGN KEY ("sprintId") REFERENCES public.sprints(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Labels Table & Task Labels Junction Table
CREATE TABLE IF NOT EXISTS public.labels (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE("workspaceId", name)
);

CREATE TABLE IF NOT EXISTS public.task_labels (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "taskId" TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  "labelId" TEXT NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE("taskId", "labelId")
);

-- 6. Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "taskId" TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Task Attachments Table
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "taskId" TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  "uploaderId" TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileSize" BIGINT NOT NULL,
  "mimeType" TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Task Activity (History / Audit Trail) Table
CREATE TABLE IF NOT EXISTS public.task_activity (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "taskId" TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field TEXT,
  "oldValue" TEXT,
  "newValue" TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Task Links (Issue Dependencies & Relationships) Table
CREATE TABLE IF NOT EXISTS public.task_links (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sourceTaskId" TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  "targetTaskId" TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  "linkType" TEXT NOT NULL CHECK ("linkType" IN ('BLOCKS', 'BLOCKED_BY', 'RELATES_TO', 'DUPLICATES', 'DUPLICATED_BY')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE("sourceTaskId", "targetTaskId", "linkType")
);

-- 10. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "recipientId" TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  "taskId" TEXT REFERENCES public.tasks(id) ON DELETE CASCADE,
  "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. Saved Filters Table
CREATE TABLE IF NOT EXISTS public.saved_filters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. Audit Log Table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  "memberId" TEXT REFERENCES public.members(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. Workflows Table
CREATE TABLE IF NOT EXISTS public.workflows (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "projectId" TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  statuses JSONB NOT NULL DEFAULT '["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]'::jsonb,
  transitions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE("projectId")
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_tasks_parentId ON public.tasks("parentId");
CREATE INDEX IF NOT EXISTS idx_tasks_reporterId ON public.tasks("reporterId");
CREATE INDEX IF NOT EXISTS idx_tasks_sprintId ON public.tasks("sprintId");
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON public.tasks(type);

CREATE INDEX IF NOT EXISTS idx_sprints_workspaceId ON public.sprints("workspaceId");
CREATE INDEX IF NOT EXISTS idx_sprints_projectId ON public.sprints("projectId");
CREATE INDEX IF NOT EXISTS idx_sprints_status ON public.sprints(status);

CREATE INDEX IF NOT EXISTS idx_labels_workspaceId ON public.labels("workspaceId");
CREATE INDEX IF NOT EXISTS idx_task_labels_taskId ON public.task_labels("taskId");
CREATE INDEX IF NOT EXISTS idx_task_labels_labelId ON public.task_labels("labelId");

CREATE INDEX IF NOT EXISTS idx_comments_taskId ON public.comments("taskId");
CREATE INDEX IF NOT EXISTS idx_comments_authorId ON public.comments("authorId");

CREATE INDEX IF NOT EXISTS idx_task_attachments_taskId ON public.task_attachments("taskId");
CREATE INDEX IF NOT EXISTS idx_task_activity_taskId ON public.task_activity("taskId");
CREATE INDEX IF NOT EXISTS idx_task_links_sourceTaskId ON public.task_links("sourceTaskId");
CREATE INDEX IF NOT EXISTS idx_task_links_targetTaskId ON public.task_links("targetTaskId");

CREATE INDEX IF NOT EXISTS idx_notifications_recipientId ON public.notifications("recipientId");
CREATE INDEX IF NOT EXISTS idx_notifications_workspaceId ON public.notifications("workspaceId");
CREATE INDEX IF NOT EXISTS idx_notifications_isRead ON public.notifications("isRead");

CREATE INDEX IF NOT EXISTS idx_saved_filters_workspaceId ON public.saved_filters("workspaceId");
CREATE INDEX IF NOT EXISTS idx_audit_log_workspaceId ON public.audit_log("workspaceId");
CREATE INDEX IF NOT EXISTS idx_members_userId_workspaceId ON public.members("userId", "workspaceId");

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Security definer helper functions for performant RLS checks
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE "workspaceId" = ws_id
      AND "userId" = (SELECT auth.uid()::text)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin_or_owner(ws_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE "workspaceId" = ws_id
      AND "userId" = (SELECT auth.uid()::text)
      AND role IN ('OWNER', 'ADMIN')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin_or_owner(TEXT) TO authenticated, service_role;

-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Policies
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or shared workspace members" ON public.profiles;
CREATE POLICY "Users can view own profile or shared workspace members"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 
      FROM public.members m1
      JOIN public.members m2 ON m1."workspaceId" = m2."workspaceId"
      WHERE m1."userId" = (SELECT auth.uid()::text)
        AND m2."userId" = profiles.id::text
    )
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- 3. Workspaces Policies
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON public.workspaces;
CREATE POLICY "Users can view workspaces they belong to"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(id) OR "userId" = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK ("userId" = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Admins or owners can update workspaces" ON public.workspaces;
CREATE POLICY "Admins or owners can update workspaces"
  ON public.workspaces FOR UPDATE
  TO authenticated
  USING (public.is_workspace_admin_or_owner(id) OR "userId" = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Admins or owners can delete workspaces" ON public.workspaces;
CREATE POLICY "Admins or owners can delete workspaces"
  ON public.workspaces FOR DELETE
  TO authenticated
  USING (public.is_workspace_admin_or_owner(id) OR "userId" = (SELECT auth.uid()::text));

-- 4. Members Policies
DROP POLICY IF EXISTS "Members can view other members in their workspaces" ON public.members;
CREATE POLICY "Members can view other members in their workspaces"
  ON public.members FOR SELECT
  TO authenticated
  USING (public.is_workspace_member("workspaceId") OR "userId" = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Admins or owners can insert members" ON public.members;
CREATE POLICY "Admins or owners can insert members"
  ON public.members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_workspace_admin_or_owner("workspaceId") 
    OR "userId" = (SELECT auth.uid()::text) -- Joining via invite
  );

DROP POLICY IF EXISTS "Admins or owners can update members" ON public.members;
CREATE POLICY "Admins or owners can update members"
  ON public.members FOR UPDATE
  TO authenticated
  USING (public.is_workspace_admin_or_owner("workspaceId"));

DROP POLICY IF EXISTS "Admins, owners, or self can delete membership" ON public.members;
CREATE POLICY "Admins, owners, or self can delete membership"
  ON public.members FOR DELETE
  TO authenticated
  USING (
    public.is_workspace_admin_or_owner("workspaceId") 
    OR "userId" = (SELECT auth.uid()::text)
  );

-- 5. Projects Policies
DROP POLICY IF EXISTS "Members can view projects in workspace" ON public.projects;
CREATE POLICY "Members can view projects in workspace"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

DROP POLICY IF EXISTS "Members can create projects in workspace" ON public.projects;
CREATE POLICY "Members can create projects in workspace"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_member("workspaceId"));

DROP POLICY IF EXISTS "Members can update projects in workspace" ON public.projects;
CREATE POLICY "Members can update projects in workspace"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

DROP POLICY IF EXISTS "Admins or owners can delete projects" ON public.projects;
CREATE POLICY "Admins or owners can delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (public.is_workspace_admin_or_owner("workspaceId"));

-- 6. Tasks Policies
DROP POLICY IF EXISTS "Members can view tasks in workspace" ON public.tasks;
CREATE POLICY "Members can view tasks in workspace"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

DROP POLICY IF EXISTS "Members can insert tasks in workspace" ON public.tasks;
CREATE POLICY "Members can insert tasks in workspace"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_member("workspaceId"));

DROP POLICY IF EXISTS "Members can update tasks in workspace" ON public.tasks;
CREATE POLICY "Members can update tasks in workspace"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

DROP POLICY IF EXISTS "Members can delete tasks in workspace" ON public.tasks;
CREATE POLICY "Members can delete tasks in workspace"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

-- 7. Sprints Policies
DROP POLICY IF EXISTS "Members can view sprints in workspace" ON public.sprints;
CREATE POLICY "Members can view sprints in workspace"
  ON public.sprints FOR SELECT
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

DROP POLICY IF EXISTS "Members can manage sprints in workspace" ON public.sprints;
CREATE POLICY "Members can manage sprints in workspace"
  ON public.sprints FOR ALL
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

-- 8. Labels & Task Labels Policies
DROP POLICY IF EXISTS "Members can view labels" ON public.labels;
CREATE POLICY "Members can view labels"
  ON public.labels FOR SELECT
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

DROP POLICY IF EXISTS "Members can manage labels" ON public.labels;
CREATE POLICY "Members can manage labels"
  ON public.labels FOR ALL
  TO authenticated
  USING (public.is_workspace_member("workspaceId"));

DROP POLICY IF EXISTS "Members can view task labels" ON public.task_labels;
CREATE POLICY "Members can view task labels"
  ON public.task_labels FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_labels."taskId" AND public.is_workspace_member(tasks."workspaceId")));

DROP POLICY IF EXISTS "Members can manage task labels" ON public.task_labels;
CREATE POLICY "Members can manage task labels"
  ON public.task_labels FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_labels."taskId" AND public.is_workspace_member(tasks."workspaceId")));

-- 9. Comments Policies
DROP POLICY IF EXISTS "Members can view comments" ON public.comments;
CREATE POLICY "Members can view comments"
  ON public.comments FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = comments."taskId" AND public.is_workspace_member(tasks."workspaceId")));

DROP POLICY IF EXISTS "Members can create comments" ON public.comments;
CREATE POLICY "Members can create comments"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = comments."taskId" AND public.is_workspace_member(tasks."workspaceId")));

DROP POLICY IF EXISTS "Authors can update comments" ON public.comments;
CREATE POLICY "Authors can update comments"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members WHERE members.id = comments."authorId" AND members."userId" = (SELECT auth.uid()::text)));

DROP POLICY IF EXISTS "Authors or admins can delete comments" ON public.comments;
CREATE POLICY "Authors or admins can delete comments"
  ON public.comments FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.members WHERE members.id = comments."authorId" AND members."userId" = (SELECT auth.uid()::text))
    OR EXISTS (SELECT 1 FROM public.tasks JOIN public.members ON members."workspaceId" = tasks."workspaceId" WHERE tasks.id = comments."taskId" AND members."userId" = (SELECT auth.uid()::text) AND members.role IN ('OWNER', 'ADMIN'))
  );

-- 10. Attachments Policies
DROP POLICY IF EXISTS "Members can view attachments" ON public.task_attachments;
CREATE POLICY "Members can view attachments"
  ON public.task_attachments FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_attachments."taskId" AND public.is_workspace_member(tasks."workspaceId")));

DROP POLICY IF EXISTS "Members can upload attachments" ON public.task_attachments;
CREATE POLICY "Members can upload attachments"
  ON public.task_attachments FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_attachments."taskId" AND public.is_workspace_member(tasks."workspaceId")));

DROP POLICY IF EXISTS "Uploaders or admins can delete attachments" ON public.task_attachments;
CREATE POLICY "Uploaders or admins can delete attachments"
  ON public.task_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.members WHERE members.id = task_attachments."uploaderId" AND members."userId" = (SELECT auth.uid()::text))
    OR EXISTS (SELECT 1 FROM public.tasks JOIN public.members ON members."workspaceId" = tasks."workspaceId" WHERE tasks.id = task_attachments."taskId" AND members."userId" = (SELECT auth.uid()::text) AND members.role IN ('OWNER', 'ADMIN'))
  );

-- 11. Activity & Links Policies
DROP POLICY IF EXISTS "Members can view task activity" ON public.task_activity;
CREATE POLICY "Members can view task activity"
  ON public.task_activity FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_activity."taskId" AND public.is_workspace_member(tasks."workspaceId")));

DROP POLICY IF EXISTS "Members can record task activity" ON public.task_activity;
CREATE POLICY "Members can record task activity"
  ON public.task_activity FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_activity."taskId" AND public.is_workspace_member(tasks."workspaceId")));

DROP POLICY IF EXISTS "Members can view task links" ON public.task_links;
CREATE POLICY "Members can view task links"
  ON public.task_links FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_links."sourceTaskId" AND public.is_workspace_member(tasks."workspaceId")));

DROP POLICY IF EXISTS "Members can manage task links" ON public.task_links;
CREATE POLICY "Members can manage task links"
  ON public.task_links FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_links."sourceTaskId" AND public.is_workspace_member(tasks."workspaceId")));

-- 12. Notifications Policies
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members WHERE members.id = notifications."recipientId" AND members."userId" = (SELECT auth.uid()::text)));

DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members WHERE members.id = notifications."recipientId" AND members."userId" = (SELECT auth.uid()::text)));

-- 13. Saved Filters, Audit Log, Workflows Policies
DROP POLICY IF EXISTS "Members can manage their saved filters" ON public.saved_filters;
CREATE POLICY "Members can manage their saved filters"
  ON public.saved_filters FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members WHERE members.id = saved_filters."memberId" AND members."userId" = (SELECT auth.uid()::text)));

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_log;
CREATE POLICY "Admins can view audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.is_workspace_admin_or_owner("workspaceId"));

DROP POLICY IF EXISTS "Members can view workflows" ON public.workflows;
CREATE POLICY "Members can view workflows"
  ON public.workflows FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = workflows."projectId" AND public.is_workspace_member(projects."workspaceId")));

DROP POLICY IF EXISTS "Admins can manage workflows" ON public.workflows;
CREATE POLICY "Admins can manage workflows"
  ON public.workflows FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = workflows."projectId" AND public.is_workspace_admin_or_owner(projects."workspaceId")));
