-- ==============================================================================
-- 004_deny_by_default.sql
-- ACCESS REQUESTS, PERMISSION GRANTS, INVITE LINKS, NOTIFICATIONS
-- DENY BY DEFAULT — every new user is view-only until explicitly granted
-- ==============================================================================

-- -----------------------------------------------------------------------
-- 1. invite_links  (role-bound public links with expiry + max uses)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invite_links (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  "roleId"    TEXT REFERENCES public.roles(id) ON DELETE SET NULL,
  code        TEXT NOT NULL UNIQUE DEFAULT substring(gen_random_uuid()::text from 1 for 10),
  label       TEXT,
  "expiresAt" TIMESTAMPTZ,
  "maxUses"   INTEGER,
  uses        INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT REFERENCES public.members(id) ON DELETE SET NULL,
  revoked     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_invite_links_workspaceId ON public.invite_links("workspaceId");
CREATE INDEX IF NOT EXISTS idx_invite_links_code        ON public.invite_links(code);
CREATE INDEX IF NOT EXISTS idx_invite_links_roleId      ON public.invite_links("roleId");

-- -----------------------------------------------------------------------
-- 2. access_requests
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_requests (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId"   TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  "requesterId"   TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  "permissionKey" TEXT NOT NULL,
  "resourceType"  TEXT,
  "resourceId"    TEXT,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','DENIED','CANCELLED','EXPIRED')),
  "reviewerId"    TEXT REFERENCES public.members(id) ON DELETE SET NULL,
  "reviewNote"    TEXT,
  "grantType"     TEXT
    CHECK ("grantType" IN ('ONE_TIME','TIME_LIMITED','PERMANENT')),
  "expiresAt"     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_access_requests_workspaceId  ON public.access_requests("workspaceId");
CREATE INDEX IF NOT EXISTS idx_access_requests_requesterId  ON public.access_requests("requesterId");
CREATE INDEX IF NOT EXISTS idx_access_requests_status       ON public.access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_permKey      ON public.access_requests("permissionKey");

-- -----------------------------------------------------------------------
-- 3. permission_grants  (temporary or resource-scoped grants)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permission_grants (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId"   TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  "memberId"      TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  "permissionKey" TEXT NOT NULL,
  "resourceType"  TEXT,
  "resourceId"    TEXT,
  "grantType"     TEXT NOT NULL DEFAULT 'PERMANENT'
    CHECK ("grantType" IN ('ONE_TIME','TIME_LIMITED','PERMANENT')),
  "usesRemaining" INTEGER,
  "expiresAt"     TIMESTAMPTZ,
  "grantedBy"     TEXT REFERENCES public.members(id) ON DELETE SET NULL,
  "requestId"     TEXT REFERENCES public.access_requests(id) ON DELETE SET NULL,
  revoked         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_perm_grants_workspaceId  ON public.permission_grants("workspaceId");
CREATE INDEX IF NOT EXISTS idx_perm_grants_memberId     ON public.permission_grants("memberId");
CREATE INDEX IF NOT EXISTS idx_perm_grants_permKey      ON public.permission_grants("permissionKey");

-- -----------------------------------------------------------------------
-- 4. notifications
-- Handles backward compatibility if notifications table was created in 001
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  "userId"      TEXT,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  "entityType"  TEXT,
  "entityId"    TEXT,
  "actionUrl"   TEXT,
  read          BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure columns exist in case table existed previously
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS "entityType" TEXT,
  ADD COLUMN IF NOT EXISTS "entityId" TEXT,
  ADD COLUMN IF NOT EXISTS "actionUrl" TEXT,
  ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT false;

-- Backfill userId from recipientId if table was created with 001 schema
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'recipientId'
  ) THEN
    UPDATE public.notifications n
    SET "userId" = m."userId"
    FROM public.members m
    WHERE n."recipientId" = m.id AND n."userId" IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'isRead'
  ) THEN
    UPDATE public.notifications SET read = "isRead" WHERE read IS NULL OR read = false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'message'
  ) THEN
    UPDATE public.notifications SET body = message WHERE body IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_userId      ON public.notifications("userId");
CREATE INDEX IF NOT EXISTS idx_notifications_workspaceId ON public.notifications("workspaceId");
CREATE INDEX IF NOT EXISTS idx_notifications_read        ON public.notifications(read);

-- -----------------------------------------------------------------------
-- 5. auto-update trigger
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = timezone('utc'::text, now()); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_access_requests_updated_at ON public.access_requests;
CREATE TRIGGER trg_access_requests_updated_at
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- -----------------------------------------------------------------------
-- 6a. has_member_permission() Postgres function
-- Checks permissions for a specific member ID, resolving:
--   1. Owner status (workspace owner via workspaces.userId OR system role with level 0)
--      NEVER from role name!
--   2. Project-level override from project_members
--   3. Direct role_permissions
--   4. Active temporary / resource-scoped permission_grants
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_member_permission(
  p_member_id      TEXT,
  p_permission_key TEXT,
  p_project_id     TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  v_role_id             TEXT;
  v_role_level          INTEGER;
  v_is_system           BOOLEAN;
  v_member_user_id      TEXT;
  v_workspace_owner_id  TEXT;
  v_eff_role            TEXT;
  v_has                 BOOLEAN := FALSE;
BEGIN
  -- Lookup member, role, and workspace owner
  SELECT m."roleId", r.level, coalesce(r."isSystem", false), m."userId", w."userId"
  INTO   v_role_id, v_role_level, v_is_system, v_member_user_id, v_workspace_owner_id
  FROM   public.members m
  JOIN   public.workspaces w ON w.id = m."workspaceId"
  LEFT JOIN public.roles r ON r.id = m."roleId"
  WHERE  m.id = p_member_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Owner bypass: MUST come from workspaces.userId (creator/owner) OR system role with level 0
  -- Custom role named "Owner" gets NO bypass because isSystem is false or level != 0!
  IF (v_member_user_id = v_workspace_owner_id) OR (v_is_system = TRUE AND v_role_level = 0) THEN
    RETURN TRUE;
  END IF;

  -- Effective role: project override wins
  v_eff_role := v_role_id;
  IF p_project_id IS NOT NULL THEN
    SELECT pm."roleId" INTO v_eff_role
    FROM   public.project_members pm
    WHERE  pm."memberId" = p_member_id AND pm."projectId" = p_project_id AND pm."roleId" IS NOT NULL
    LIMIT  1;
    IF NOT FOUND THEN v_eff_role := v_role_id; END IF;
  END IF;

  -- role_permissions check
  IF v_eff_role IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.role_permissions rp
      WHERE rp."roleId" = v_eff_role AND rp."permissionKey" = p_permission_key AND rp.allowed = TRUE
    ) INTO v_has;
    IF v_has THEN RETURN TRUE; END IF;
  END IF;

  -- Active grants check
  SELECT EXISTS(
    SELECT 1 FROM public.permission_grants pg
    WHERE  pg."memberId" = p_member_id
      AND  pg."permissionKey" = p_permission_key
      AND  pg.revoked = FALSE
      AND  (pg."expiresAt" IS NULL OR pg."expiresAt" > now())
      AND  (pg."usesRemaining" IS NULL OR pg."usesRemaining" > 0)
      AND  (pg."resourceId" IS NULL OR pg."resourceId" = p_project_id)
  ) INTO v_has;

  RETURN v_has;
END $$;

-- -----------------------------------------------------------------------
-- 6b. has_permission() — Backward compatibility for 003 policies
-- Resolves the authenticated caller's member record in the workspace,
-- and delegates to has_member_permission.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(
  p_workspace_id TEXT,
  p_perm_key     TEXT,
  p_project_id   TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  v_user_id   TEXT := (SELECT auth.uid()::text);
  v_member_id TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT m.id INTO v_member_id
  FROM   public.members m
  WHERE  m."workspaceId" = p_workspace_id AND m."userId" = v_user_id
  LIMIT  1;

  IF v_member_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN public.has_member_permission(v_member_id, p_perm_key, p_project_id);
END $$;

-- -----------------------------------------------------------------------
-- 6c. consume_grant_use() — Atomic one-time grant consumption
-- Decrements usesRemaining by 1 in a single UPDATE with a WHERE guard.
-- Returns TRUE if a row was actually consumed, FALSE otherwise.
-- Verifies caller owns the grant (or called by service_role).
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_grant_use(
  p_grant_id TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
  v_user_id TEXT := (SELECT auth.uid()::text);
BEGIN
  -- If invoked by authenticated user, verify they own the grant
  IF v_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.permission_grants pg
      JOIN public.members m ON m.id = pg."memberId"
      WHERE pg.id = p_grant_id AND m."userId" = v_user_id
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  UPDATE public.permission_grants
  SET    "usesRemaining" = "usesRemaining" - 1
  WHERE  id = p_grant_id
    AND  revoked = FALSE
    AND  "usesRemaining" IS NOT NULL
    AND  "usesRemaining" > 0
    AND  ("expiresAt" IS NULL OR "expiresAt" > now());

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END $$;

REVOKE EXECUTE ON FUNCTION public.consume_grant_use(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_grant_use(TEXT) TO authenticated, service_role;

-- -----------------------------------------------------------------------
-- 6d. consume_invite_link_use() — Atomic invite link use increment
-- Increments uses by 1 only if unrevoked, unexpired, and uses < maxUses
-- Returns the updated row, or empty set if invalid/exhausted
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_invite_link_use(
  p_code TEXT
)
RETURNS SETOF public.invite_links LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.invite_links
  SET    uses = uses + 1
  WHERE  code = p_code
    AND  revoked = FALSE
    AND  ("maxUses" IS NULL OR uses < "maxUses")
    AND  ("expiresAt" IS NULL OR "expiresAt" > now())
  RETURNING *;
END $$;

REVOKE EXECUTE ON FUNCTION public.consume_invite_link_use(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_invite_link_use(TEXT) TO authenticated, service_role;

-- -----------------------------------------------------------------------
-- 7. RLS
-- -----------------------------------------------------------------------
ALTER TABLE public.invite_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications   ENABLE ROW LEVEL SECURITY;

-- invite_links
DROP POLICY IF EXISTS "Members can view invite links" ON public.invite_links;
CREATE POLICY "Members can view invite links"
  ON public.invite_links FOR SELECT
  USING (EXISTS(
    SELECT 1 FROM public.members m
    WHERE m."workspaceId" = public.invite_links."workspaceId" AND m."userId" = (SELECT auth.uid()::text)
  ));

DROP POLICY IF EXISTS "Admins can manage invite links" ON public.invite_links;
CREATE POLICY "Admins can manage invite links"
  ON public.invite_links FOR ALL
  USING (EXISTS(
    SELECT 1 FROM public.members m
    WHERE m."workspaceId" = public.invite_links."workspaceId"
      AND m."userId" = (SELECT auth.uid()::text)
      AND public.has_member_permission(m.id, 'invites:manage')
  ));

-- access_requests: requester sees own
DROP POLICY IF EXISTS "Requester views own requests" ON public.access_requests;
CREATE POLICY "Requester views own requests"
  ON public.access_requests FOR SELECT
  USING (EXISTS(
    SELECT 1 FROM public.members m
    WHERE m.id = public.access_requests."requesterId" AND m."userId" = (SELECT auth.uid()::text)
  ));

-- access_requests: reviewer sees all in workspace
DROP POLICY IF EXISTS "Reviewers view requests" ON public.access_requests;
CREATE POLICY "Reviewers view requests"
  ON public.access_requests FOR SELECT
  USING (EXISTS(
    SELECT 1 FROM public.members m
    WHERE m."workspaceId" = public.access_requests."workspaceId"
      AND m."userId" = (SELECT auth.uid()::text)
      AND public.has_member_permission(m.id, 'requests.review')
  ));

DROP POLICY IF EXISTS "Members can create requests" ON public.access_requests;
CREATE POLICY "Members can create requests"
  ON public.access_requests FOR INSERT
  WITH CHECK (EXISTS(
    SELECT 1 FROM public.members m
    WHERE m.id = public.access_requests."requesterId"
      AND m."userId" = (SELECT auth.uid()::text)
      AND m."workspaceId" = public.access_requests."workspaceId"
  ));

DROP POLICY IF EXISTS "Requesters can cancel" ON public.access_requests;
CREATE POLICY "Requesters can cancel"
  ON public.access_requests FOR UPDATE
  USING (
    EXISTS(SELECT 1 FROM public.members m WHERE m.id = public.access_requests."requesterId" AND m."userId" = (SELECT auth.uid()::text))
    AND status = 'PENDING'
  );

DROP POLICY IF EXISTS "Reviewers can update requests" ON public.access_requests;
CREATE POLICY "Reviewers can update requests"
  ON public.access_requests FOR UPDATE
  USING (EXISTS(
    SELECT 1 FROM public.members m
    WHERE m."workspaceId" = public.access_requests."workspaceId"
      AND m."userId" = (SELECT auth.uid()::text)
      AND public.has_member_permission(m.id, 'requests.review')
  ));

-- permission_grants
DROP POLICY IF EXISTS "Members view own grants" ON public.permission_grants;
CREATE POLICY "Members view own grants"
  ON public.permission_grants FOR SELECT
  USING (EXISTS(
    SELECT 1 FROM public.members m
    WHERE m.id = public.permission_grants."memberId" AND m."userId" = (SELECT auth.uid()::text)
  ));

DROP POLICY IF EXISTS "Reviewers manage grants" ON public.permission_grants;
CREATE POLICY "Reviewers manage grants"
  ON public.permission_grants FOR ALL
  USING (EXISTS(
    SELECT 1 FROM public.members m
    WHERE m."workspaceId" = public.permission_grants."workspaceId"
      AND m."userId" = (SELECT auth.uid()::text)
      AND public.has_member_permission(m.id, 'requests.review')
  ));

-- notifications
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT
  USING ("userId" = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS "Users mark read" ON public.notifications;
CREATE POLICY "Users mark read"
  ON public.notifications FOR UPDATE
  USING ("userId" = (SELECT auth.uid()::text));

-- -----------------------------------------------------------------------
-- 8. Realtime
-- -----------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.access_requests;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- -----------------------------------------------------------------------
-- 9. Ensure workspace role seeding runs as SECURITY DEFINER
-- -----------------------------------------------------------------------
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

DO $$
BEGIN
  RAISE NOTICE '004_deny_by_default: invite_links, access_requests, permission_grants, notifications, seed triggers — done.';
END $$;

