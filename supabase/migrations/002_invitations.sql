-- 002_invitations.sql
-- Table and policies for Workspace Email Invitations with Role Selection

CREATE TABLE IF NOT EXISTS public.invitations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'PROJECT_MANAGER', 'MEMBER', 'VIEWER', 'GUEST')),
  code TEXT NOT NULL,
  "inviterId" TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_invitations_workspaceId ON public.invitations("workspaceId");
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_code ON public.invitations(code);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Members can view invitations in their workspace" ON public.invitations;
DROP POLICY IF EXISTS "Admins or owners can manage invitations" ON public.invitations;

-- Workspace members can view pending invites in their workspace
CREATE POLICY "Members can view invitations in their workspace"
  ON public.invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m."workspaceId" = public.invitations."workspaceId"
        AND m."userId" = (SELECT auth.uid()::text)
    )
  );

-- Admins and owners can create/update/delete invites
CREATE POLICY "Admins or owners can manage invitations"
  ON public.invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m."workspaceId" = public.invitations."workspaceId"
        AND m."userId" = (SELECT auth.uid()::text)
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );
