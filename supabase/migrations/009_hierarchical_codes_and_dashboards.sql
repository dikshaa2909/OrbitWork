-- ==============================================================================
-- 009 – Hierarchical Codes & Persona-Driven Workspace Dashboards
-- ==============================================================================

-- 1. Enhance public.invite_links with Hierarchical College Scope
ALTER TABLE public.invite_links
ADD COLUMN IF NOT EXISTS target_role TEXT 
  CHECK (target_role IN ('FACULTY_GUIDE', 'STUDENT_LEAD', 'STUDENT', 'MEMBER', 'ADMIN', 'VIEWER')),
ADD COLUMN IF NOT EXISTS academic_team_id UUID REFERENCES public.academic_teams(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS created_by_member_id TEXT;

CREATE INDEX IF NOT EXISTS idx_invite_links_academic_team ON public.invite_links(academic_team_id);
CREATE INDEX IF NOT EXISTS idx_invite_links_target_role ON public.invite_links(target_role);
CREATE INDEX IF NOT EXISTS idx_invite_links_batch ON public.invite_links(batch_id);

-- 2. Atomic Join RPC for Hierarchical Workspace & Group Join
CREATE OR REPLACE FUNCTION public.accept_workspace_invite_code(
  p_code TEXT,
  p_user_id TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  workspace_id TEXT,
  member_id TEXT,
  target_role TEXT,
  academic_team_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_link RECORD;
  v_member_id TEXT;
  v_assigned_role TEXT := 'MEMBER';
  v_assigned_role_id TEXT := NULL;
  v_team_role TEXT := 'MEMBER';
BEGIN
  -- Normalize code
  p_code := trim(upper(p_code));

  -- 1. Find and validate invite link
  SELECT * INTO v_link
  FROM public.invite_links
  WHERE code = p_code
    AND revoked = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, 'Invalid or revoked invite code'::TEXT;
    RETURN;
  END IF;

  IF v_link."expiresAt" IS NOT NULL AND v_link."expiresAt" < now() THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, 'Invite code has expired'::TEXT;
    RETURN;
  END IF;

  IF v_link."maxUses" IS NOT NULL AND v_link.uses >= v_link."maxUses" THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, 'Invite code has reached maximum uses'::TEXT;
    RETURN;
  END IF;

  -- 2. Resolve Role mapping based on target_role
  IF v_link.target_role = 'FACULTY_GUIDE' THEN
    -- Look up Faculty Guide / Project Manager role in this workspace
    SELECT id INTO v_assigned_role_id
    FROM public.roles
    WHERE "workspaceId" = v_link."workspaceId"
      AND (name ILIKE '%Project Manager%' OR name ILIKE '%Faculty%' OR level = 30)
    LIMIT 1;
    v_assigned_role := 'MEMBER';
  ELSIF v_link.target_role = 'STUDENT_LEAD' THEN
    SELECT id INTO v_assigned_role_id
    FROM public.roles
    WHERE "workspaceId" = v_link."workspaceId"
      AND (name ILIKE '%Team Lead%' OR name ILIKE '%Lead%' OR level = 40)
    LIMIT 1;
    v_assigned_role := 'MEMBER';
    v_team_role := 'LEAD';
  ELSIF v_link.target_role = 'STUDENT' THEN
    SELECT id INTO v_assigned_role_id
    FROM public.roles
    WHERE "workspaceId" = v_link."workspaceId"
      AND (name ILIKE '%Member%' OR level = 50)
    LIMIT 1;
    v_assigned_role := 'MEMBER';
    v_team_role := 'MEMBER';
  ELSIF v_link."roleId" IS NOT NULL THEN
    v_assigned_role_id := v_link."roleId";
  END IF;

  -- 3. Check existing membership in public.members
  SELECT id INTO v_member_id
  FROM public.members
  WHERE "workspaceId" = v_link."workspaceId"
    AND "userId" = p_user_id
  LIMIT 1;

  IF v_member_id IS NULL THEN
    -- Insert new workspace member
    INSERT INTO public.members (
      "workspaceId",
      "userId",
      role,
      "roleId",
      created_at,
      updated_at
    ) VALUES (
      v_link."workspaceId",
      p_user_id,
      v_assigned_role,
      v_assigned_role_id,
      timezone('utc', now()),
      timezone('utc', now())
    )
    RETURNING id INTO v_member_id;
  ELSE
    -- If already a member, update roleId if target_role is more specific and user roleId is null
    IF v_assigned_role_id IS NOT NULL THEN
      UPDATE public.members
      SET "roleId" = COALESCE("roleId", v_assigned_role_id),
          updated_at = timezone('utc', now())
      WHERE id = v_member_id;
    END IF;
  END IF;

  -- 4. Automatically join Academic Team if team-scoped
  IF v_link.academic_team_id IS NOT NULL THEN
    INSERT INTO public.academic_team_members (
      team_id,
      member_id,
      role,
      joined_at
    ) VALUES (
      v_link.academic_team_id,
      v_member_id,
      v_team_role,
      timezone('utc', now())
    )
    ON CONFLICT (team_id, member_id) DO UPDATE
    SET role = CASE 
      WHEN v_team_role = 'LEAD' THEN 'LEAD' 
      ELSE public.academic_team_members.role 
    END;

    -- Also auto-join group chat channel if one exists
    INSERT INTO public.channel_members (
      channel_id,
      member_id,
      role,
      joined_at
    )
    SELECT c.id, v_member_id, 'MEMBER', timezone('utc', now())
    FROM public.channels c
    WHERE c.team_id = v_link.academic_team_id
      AND NOT EXISTS (
        SELECT 1 FROM public.channel_members cm 
        WHERE cm.channel_id = c.id AND cm.member_id = v_member_id
      );
  END IF;

  -- 5. Atomically increment uses count
  UPDATE public.invite_links
  SET uses = uses + 1
  WHERE id = v_link.id;

  RETURN QUERY SELECT 
    TRUE,
    v_link."workspaceId",
    v_member_id,
    v_link.target_role,
    v_link.academic_team_id,
    NULL::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_workspace_invite_code(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite_code(TEXT, TEXT) TO authenticated, service_role;

