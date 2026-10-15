-- ==============================================================================
-- 003_configurable_permissions.sql
-- CONFIGURABLE ROLES, PERMISSIONS, PROJECT OVERRIDES, TEAMS & ORG HIERARCHY
-- ==============================================================================

-- 1. Create Roles Table
CREATE TABLE IF NOT EXISTS public.roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  level INTEGER NOT NULL DEFAULT 30, -- 0=Owner, 10=Admin, 20=PM, 30=Member, 40=Viewer, 50=Guest
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_roles_workspace_name UNIQUE ("workspaceId", name)
);

CREATE INDEX IF NOT EXISTS idx_roles_workspaceId ON public.roles("workspaceId");
CREATE INDEX IF NOT EXISTS idx_roles_level ON public.roles(level);

-- 2. Create Role Permissions Table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "roleId" TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  "permissionKey" TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_role_permissions_role_key UNIQUE ("roleId", "permissionKey")
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_roleId ON public.role_permissions("roleId");
CREATE INDEX IF NOT EXISTS idx_role_permissions_key ON public.role_permissions("permissionKey");

-- 3. Extend Members Table (add roleId and reportsToId)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'roleId'
  ) THEN
    ALTER TABLE public.members ADD COLUMN "roleId" TEXT REFERENCES public.roles(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'reportsToId'
  ) THEN
    ALTER TABLE public.members ADD COLUMN "reportsToId" TEXT REFERENCES public.members(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_members_roleId ON public.members("roleId");
CREATE INDEX IF NOT EXISTS idx_members_reportsToId ON public.members("reportsToId");

-- 4. Create Project Members Table (Project-Level Role Overrides)
CREATE TABLE IF NOT EXISTS public.project_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "projectId" TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  "roleId" TEXT REFERENCES public.roles(id) ON DELETE SET NULL, -- if null, inherits workspace role
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_project_members_project_member UNIQUE ("projectId", "memberId")
);

CREATE INDEX IF NOT EXISTS idx_project_members_projectId ON public.project_members("projectId");
CREATE INDEX IF NOT EXISTS idx_project_members_memberId ON public.project_members("memberId");

-- 5. Create Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  "leadMemberId" TEXT REFERENCES public.members(id) ON DELETE SET NULL,
  "parentTeamId" TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_teams_workspace_name UNIQUE ("workspaceId", name)
);

CREATE INDEX IF NOT EXISTS idx_teams_workspaceId ON public.teams("workspaceId");
CREATE INDEX IF NOT EXISTS idx_teams_leadMemberId ON public.teams("leadMemberId");
CREATE INDEX IF NOT EXISTS idx_teams_parentTeamId ON public.teams("parentTeamId");

-- 6. Create Team Members Table
CREATE TABLE IF NOT EXISTS public.team_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "teamId" TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_team_members_team_member UNIQUE ("teamId", "memberId")
);

CREATE INDEX IF NOT EXISTS idx_team_members_teamId ON public.team_members("teamId");
CREATE INDEX IF NOT EXISTS idx_team_members_memberId ON public.team_members("memberId");

-- 7. Create Permission Audit Table
CREATE TABLE IF NOT EXISTS public.permission_audit (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  "actorMemberId" TEXT REFERENCES public.members(id) ON DELETE SET NULL,
  "entityType" TEXT NOT NULL CHECK ("entityType" IN ('ROLE', 'PERMISSION', 'MEMBER_ROLE', 'PROJECT_OVERRIDE', 'TEAM')),
  "entityId" TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'ASSIGN')),
  "oldValues" JSONB,
  "newValues" JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_permission_audit_workspaceId ON public.permission_audit("workspaceId");
CREATE INDEX IF NOT EXISTS idx_permission_audit_createdAt ON public.permission_audit(created_at DESC);

-- 8. Create Workspace Settings Table (Optional workflow approvals, etc.)
CREATE TABLE IF NOT EXISTS public.workspace_settings (
  "workspaceId" TEXT PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  "requireDoneApproval" BOOLEAN NOT NULL DEFAULT false,
  "doneApproverRoleId" TEXT REFERENCES public.roles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 9. SEED FUNCTION: Populates 6 system roles & default permissions for a workspace
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.seed_workspace_roles(p_workspace_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_owner_role_id TEXT;
  v_admin_role_id TEXT;
  v_pm_role_id TEXT;
  v_member_role_id TEXT;
  v_viewer_role_id TEXT;
  v_guest_role_id TEXT;
BEGIN
  -- 1. Insert or get Owner Role (level 0)
  INSERT INTO public.roles ("workspaceId", name, description, color, "isSystem", level)
  VALUES (p_workspace_id, 'Owner', 'Workspace owner with absolute control over all settings and data.', '#e11d48', true, 0)
  ON CONFLICT ("workspaceId", name) DO UPDATE SET "isSystem" = true, level = 0
  RETURNING id INTO v_owner_role_id;

  -- 2. Admin Role (level 10)
  INSERT INTO public.roles ("workspaceId", name, description, color, "isSystem", level)
  VALUES (p_workspace_id, 'Admin', 'Workspace administrator who can manage members, projects, and settings.', '#7c3aed', true, 10)
  ON CONFLICT ("workspaceId", name) DO UPDATE SET "isSystem" = true, level = 10
  RETURNING id INTO v_admin_role_id;

  -- 3. Project Manager Role (level 20)
  INSERT INTO public.roles ("workspaceId", name, description, color, "isSystem", level)
  VALUES (p_workspace_id, 'Project Manager', 'Manages projects, sprints, backlog, task assignments, and reporting.', '#2563eb', true, 20)
  ON CONFLICT ("workspaceId", name) DO UPDATE SET "isSystem" = true, level = 20
  RETURNING id INTO v_pm_role_id;

  -- 4. Member Role (level 30)
  INSERT INTO public.roles ("workspaceId", name, description, color, "isSystem", level)
  VALUES (p_workspace_id, 'Member', 'Standard team member. Can create tasks, edit assigned tasks, and comment.', '#16a34a', true, 30)
  ON CONFLICT ("workspaceId", name) DO UPDATE SET "isSystem" = true, level = 30
  RETURNING id INTO v_member_role_id;

  -- 5. Viewer Role (level 40)
  INSERT INTO public.roles ("workspaceId", name, description, color, "isSystem", level)
  VALUES (p_workspace_id, 'Viewer', 'Read-only access to projects, tasks, comments, and reports.', '#64748b', true, 40)
  ON CONFLICT ("workspaceId", name) DO UPDATE SET "isSystem" = true, level = 40
  RETURNING id INTO v_viewer_role_id;

  -- 6. Guest Role (level 50)
  INSERT INTO public.roles ("workspaceId", name, description, color, "isSystem", level)
  VALUES (p_workspace_id, 'Guest', 'Restricted guest. Can only see tasks directly assigned to them.', '#d97706', true, 50)
  ON CONFLICT ("workspaceId", name) DO UPDATE SET "isSystem" = true, level = 50
  RETURNING id INTO v_guest_role_id;

  -- Insert Role Permissions
  -- OWNER has all permissions
  INSERT INTO public.role_permissions ("roleId", "permissionKey", allowed)
  VALUES
    (v_owner_role_id, 'workspace:settings.edit', true),
    (v_owner_role_id, 'workspace:delete', true),
    (v_owner_role_id, 'workspace:invite_code.manage', true),
    (v_owner_role_id, 'members:invite', true),
    (v_owner_role_id, 'members:remove', true),
    (v_owner_role_id, 'members:roles.assign', true),
    (v_owner_role_id, 'members:view', true),
    (v_owner_role_id, 'roles:manage', true),
    (v_owner_role_id, 'projects:create', true),
    (v_owner_role_id, 'projects:edit', true),
    (v_owner_role_id, 'projects:delete', true),
    (v_owner_role_id, 'projects:settings.manage', true),
    (v_owner_role_id, 'projects:members.manage', true),
    (v_owner_role_id, 'tasks:create', true),
    (v_owner_role_id, 'tasks:view.all', true),
    (v_owner_role_id, 'tasks:edit.any', true),
    (v_owner_role_id, 'tasks:delete.any', true),
    (v_owner_role_id, 'tasks:assign', true),
    (v_owner_role_id, 'tasks:transition', true),
    (v_owner_role_id, 'tasks:bulk_edit', true),
    (v_owner_role_id, 'sprints:manage', true),
    (v_owner_role_id, 'comments:create', true),
    (v_owner_role_id, 'comments:delete.any', true),
    (v_owner_role_id, 'reports:view', true),
    (v_owner_role_id, 'reports:export', true),
    (v_owner_role_id, 'time:log_own', true),
    (v_owner_role_id, 'time:view_team', true),
    (v_owner_role_id, 'time:view_all', true),
    (v_owner_role_id, 'time:approve_timesheets', true),
    (v_owner_role_id, 'chat:channels.create', true),
    (v_owner_role_id, 'chat:channels.moderate', true),
    (v_owner_role_id, 'chat:dm', true),
    (v_owner_role_id, 'ai:use', true),
    (v_owner_role_id, 'audit:view', true)
  ON CONFLICT ("roleId", "permissionKey") DO UPDATE SET allowed = true;

  -- ADMIN has all except workspace:delete
  INSERT INTO public.role_permissions ("roleId", "permissionKey", allowed)
  VALUES
    (v_admin_role_id, 'workspace:settings.edit', true),
    (v_admin_role_id, 'workspace:invite_code.manage', true),
    (v_admin_role_id, 'members:invite', true),
    (v_admin_role_id, 'members:remove', true),
    (v_admin_role_id, 'members:roles.assign', true),
    (v_admin_role_id, 'members:view', true),
    (v_admin_role_id, 'roles:manage', true),
    (v_admin_role_id, 'projects:create', true),
    (v_admin_role_id, 'projects:edit', true),
    (v_admin_role_id, 'projects:delete', true),
    (v_admin_role_id, 'projects:settings.manage', true),
    (v_admin_role_id, 'projects:members.manage', true),
    (v_admin_role_id, 'tasks:create', true),
    (v_admin_role_id, 'tasks:view.all', true),
    (v_admin_role_id, 'tasks:edit.any', true),
    (v_admin_role_id, 'tasks:delete.any', true),
    (v_admin_role_id, 'tasks:assign', true),
    (v_admin_role_id, 'tasks:transition', true),
    (v_admin_role_id, 'tasks:bulk_edit', true),
    (v_admin_role_id, 'sprints:manage', true),
    (v_admin_role_id, 'comments:create', true),
    (v_admin_role_id, 'comments:delete.any', true),
    (v_admin_role_id, 'reports:view', true),
    (v_admin_role_id, 'reports:export', true),
    (v_admin_role_id, 'time:log_own', true),
    (v_admin_role_id, 'time:view_team', true),
    (v_admin_role_id, 'time:view_all', true),
    (v_admin_role_id, 'time:approve_timesheets', true),
    (v_admin_role_id, 'chat:channels.create', true),
    (v_admin_role_id, 'chat:channels.moderate', true),
    (v_admin_role_id, 'chat:dm', true),
    (v_admin_role_id, 'ai:use', true),
    (v_admin_role_id, 'audit:view', true)
  ON CONFLICT ("roleId", "permissionKey") DO UPDATE SET allowed = true;

  -- PROJECT MANAGER
  INSERT INTO public.role_permissions ("roleId", "permissionKey", allowed)
  VALUES
    (v_pm_role_id, 'members:view', true),
    (v_pm_role_id, 'projects:create', true),
    (v_pm_role_id, 'projects:edit', true),
    (v_pm_role_id, 'projects:settings.manage', true),
    (v_pm_role_id, 'projects:members.manage', true),
    (v_pm_role_id, 'tasks:create', true),
    (v_pm_role_id, 'tasks:view.all', true),
    (v_pm_role_id, 'tasks:edit.any', true),
    (v_pm_role_id, 'tasks:delete.any', true),
    (v_pm_role_id, 'tasks:assign', true),
    (v_pm_role_id, 'tasks:transition', true),
    (v_pm_role_id, 'tasks:bulk_edit', true),
    (v_pm_role_id, 'sprints:manage', true),
    (v_pm_role_id, 'comments:create', true),
    (v_pm_role_id, 'comments:delete.any', true),
    (v_pm_role_id, 'reports:view', true),
    (v_pm_role_id, 'reports:export', true),
    (v_pm_role_id, 'time:log_own', true),
    (v_pm_role_id, 'time:view_team', true),
    (v_pm_role_id, 'time:approve_timesheets', true),
    (v_pm_role_id, 'chat:channels.create', true),
    (v_pm_role_id, 'chat:channels.moderate', true),
    (v_pm_role_id, 'chat:dm', true),
    (v_pm_role_id, 'ai:use', true)
  ON CONFLICT ("roleId", "permissionKey") DO UPDATE SET allowed = true;

  -- MEMBER
  INSERT INTO public.role_permissions ("roleId", "permissionKey", allowed)
  VALUES
    (v_member_role_id, 'members:view', true),
    (v_member_role_id, 'tasks:create', true),
    (v_member_role_id, 'tasks:view.all', true),
    (v_member_role_id, 'tasks:edit.own', true),
    (v_member_role_id, 'tasks:delete.own', true),
    (v_member_role_id, 'tasks:transition', true),
    (v_member_role_id, 'comments:create', true),
    (v_member_role_id, 'comments:delete.own', true),
    (v_member_role_id, 'reports:view', true),
    (v_member_role_id, 'time:log_own', true),
    (v_member_role_id, 'chat:dm', true),
    (v_member_role_id, 'ai:use', true)
  ON CONFLICT ("roleId", "permissionKey") DO UPDATE SET allowed = true;

  -- VIEWER
  INSERT INTO public.role_permissions ("roleId", "permissionKey", allowed)
  VALUES
    (v_viewer_role_id, 'members:view', true),
    (v_viewer_role_id, 'tasks:view.all', true),
    (v_viewer_role_id, 'reports:view', true),
    (v_viewer_role_id, 'chat:dm', true)
  ON CONFLICT ("roleId", "permissionKey") DO UPDATE SET allowed = true;

  -- GUEST
  INSERT INTO public.role_permissions ("roleId", "permissionKey", allowed)
  VALUES
    (v_guest_role_id, 'tasks:view.assigned_only', true),
    (v_guest_role_id, 'comments:create', true),
    (v_guest_role_id, 'comments:delete.own', true),
    (v_guest_role_id, 'chat:dm', true)
  ON CONFLICT ("roleId", "permissionKey") DO UPDATE SET allowed = true;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 10. Trigger on new workspace creation to automatically seed roles
CREATE OR REPLACE FUNCTION public.handle_new_workspace_seed()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.seed_workspace_roles(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_workspace_created_seed_roles ON public.workspaces;
CREATE TRIGGER on_workspace_created_seed_roles
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace_seed();

-- 11. Run seed for all existing workspaces and migrate existing members
DO $$
DECLARE
  ws RECORD;
BEGIN
  FOR ws IN SELECT id FROM public.workspaces LOOP
    PERFORM public.seed_workspace_roles(ws.id);
  END LOOP;
END $$;

-- Backfill members.roleId from existing members.role string
UPDATE public.members m
SET "roleId" = r.id
FROM public.roles r
WHERE r."workspaceId" = m."workspaceId"
  AND m."roleId" IS NULL
  AND (
    (m.role = 'OWNER' AND r.name = 'Owner') OR
    (m.role = 'ADMIN' AND r.name = 'Admin') OR
    (m.role = 'PROJECT_MANAGER' AND r.name = 'Project Manager') OR
    (m.role = 'MEMBER' AND r.name = 'Member') OR
    (m.role = 'VIEWER' AND r.name = 'Viewer') OR
    (m.role = 'GUEST' AND r.name = 'Guest')
  );

-- Default any remaining members to Member role
UPDATE public.members m
SET "roleId" = (
  SELECT r.id FROM public.roles r 
  WHERE r."workspaceId" = m."workspaceId" AND r.name = 'Member' 
  LIMIT 1
)
WHERE m."roleId" IS NULL;

-- ==============================================================================
-- 12. DATABASE PERMISSION CHECK FUNCTION (SECURITY DEFINER)
-- Evaluates permission resolution including Owner bypass, Project override & Workspace role
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.has_permission(
  p_workspace_id TEXT,
  p_perm_key TEXT,
  p_project_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id TEXT := auth.uid()::text;
  v_member_id TEXT;
  v_ws_role_id TEXT;
  v_ws_level INTEGER;
  v_project_role_id TEXT;
  v_effective_role_id TEXT;
  v_allowed BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Find member record in workspace
  SELECT m.id, m."roleId", r.level
  INTO v_member_id, v_ws_role_id, v_ws_level
  FROM public.members m
  JOIN public.roles r ON r.id = m."roleId"
  WHERE m."workspaceId" = p_workspace_id AND m."userId" = v_user_id;

  IF v_member_id IS NULL THEN
    RETURN false;
  END IF;

  -- 2. Owner bypass (level 0 is always allowed everything)
  IF v_ws_level = 0 THEN
    RETURN true;
  END IF;

  -- 3. Check for Project-Level Role Override
  IF p_project_id IS NOT NULL THEN
    SELECT pm."roleId"
    INTO v_project_role_id
    FROM public.project_members pm
    WHERE pm."projectId" = p_project_id AND pm."memberId" = v_member_id;
  END IF;

  -- Effective role: project override first, then workspace role
  v_effective_role_id := COALESCE(v_project_role_id, v_ws_role_id);

  -- 4. Check if permissionKey is allowed
  SELECT rp.allowed
  INTO v_allowed
  FROM public.role_permissions rp
  WHERE rp."roleId" = v_effective_role_id AND rp."permissionKey" = p_perm_key;

  RETURN COALESCE(v_allowed, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Members can view workspace roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can manage workspace roles" ON public.roles;
DROP POLICY IF EXISTS "Members can view role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Admins and PMs can manage project members" ON public.project_members;
DROP POLICY IF EXISTS "Members can view workspace teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can manage workspace teams" ON public.teams;
DROP POLICY IF EXISTS "Members can view team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Members can view audit logs" ON public.permission_audit;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.permission_audit;
DROP POLICY IF EXISTS "Members can view workspace settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "Admins can update workspace settings" ON public.workspace_settings;

-- Roles Policies
CREATE POLICY "Members can view workspace roles"
  ON public.roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m."workspaceId" = public.roles."workspaceId"
        AND m."userId" = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Admins can manage workspace roles"
  ON public.roles FOR ALL
  USING (
    public.has_permission(public.roles."workspaceId", 'roles:manage')
  );

-- Role Permissions Policies
CREATE POLICY "Members can view role permissions"
  ON public.role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      JOIN public.members m ON m."workspaceId" = r."workspaceId"
      WHERE r.id = public.role_permissions."roleId"
        AND m."userId" = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Admins can manage role permissions"
  ON public.role_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = public.role_permissions."roleId"
        AND public.has_permission(r."workspaceId", 'roles:manage')
    )
  );

-- Project Members Policies
CREATE POLICY "Members can view project members"
  ON public.project_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.members m ON m."workspaceId" = p."workspaceId"
      WHERE p.id = public.project_members."projectId"
        AND m."userId" = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Admins and PMs can manage project members"
  ON public.project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = public.project_members."projectId"
        AND (
          public.has_permission(p."workspaceId", 'projects:members.manage', p.id) OR
          public.has_permission(p."workspaceId", 'projects:settings.manage', p.id)
        )
    )
  );

-- Teams Policies
CREATE POLICY "Members can view workspace teams"
  ON public.teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m."workspaceId" = public.teams."workspaceId"
        AND m."userId" = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Admins can manage workspace teams"
  ON public.teams FOR ALL
  USING (
    public.has_permission(public.teams."workspaceId", 'workspace:settings.edit')
  );

-- Team Members Policies
CREATE POLICY "Members can view team members"
  ON public.team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.members m ON m."workspaceId" = t."workspaceId"
      WHERE t.id = public.team_members."teamId"
        AND m."userId" = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Admins can manage team members"
  ON public.team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = public.team_members."teamId"
        AND public.has_permission(t."workspaceId", 'workspace:settings.edit')
    )
  );

-- Permission Audit Policies
CREATE POLICY "Members can view audit logs"
  ON public.permission_audit FOR SELECT
  USING (
    public.has_permission(public.permission_audit."workspaceId", 'audit:view')
  );

CREATE POLICY "Admins can insert audit logs"
  ON public.permission_audit FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m."workspaceId" = public.permission_audit."workspaceId"
        AND m."userId" = (SELECT auth.uid()::text)
    )
  );

-- Workspace Settings Policies
CREATE POLICY "Members can view workspace settings"
  ON public.workspace_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m."workspaceId" = public.workspace_settings."workspaceId"
        AND m."userId" = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Admins can update workspace settings"
  ON public.workspace_settings FOR ALL
  USING (
    public.has_permission(public.workspace_settings."workspaceId", 'workspace:settings.edit')
  );
