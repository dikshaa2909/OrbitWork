-- ==============================================================================
-- 005 – Team Chat: Channels, Channel Members, Messages, Reactions
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create Tables First (so all forward references resolve cleanly)
-- ------------------------------------------------------------------------------

-- 1a. Channels Table
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (type IN ('WORKSPACE', 'PROJECT', 'TEAM', 'PRIVATE', 'DM')),
  name TEXT,
  description TEXT,
  project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
  team_id UUID,
  created_by TEXT NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_channels_workspace ON public.channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON public.channels(workspace_id, type);

-- 1b. Channel Members Table
CREATE TABLE IF NOT EXISTS public.channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'MODERATOR', 'MEMBER')),
  last_read_message_id UUID,
  muted_until TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (channel_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_member ON public.channel_members(member_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON public.channel_members(channel_id);

-- 1c. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  parent_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  body TEXT NOT NULL DEFAULT '',
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  task_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(parent_message_id) WHERE parent_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_author ON public.messages(author_id);

-- 1d. Message Reactions Table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (message_id, member_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON public.message_reactions(message_id);

-- ------------------------------------------------------------------------------
-- 2. Enable Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. RLS Policies (All referenced tables now exist)
-- ------------------------------------------------------------------------------

-- Channels Policies
DROP POLICY IF EXISTS channels_select ON public.channels;
CREATE POLICY channels_select ON public.channels FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.channel_members cm
    WHERE cm.channel_id = id AND cm.member_id = auth.uid()::text
  )
  OR (
    type = 'WORKSPACE' AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m."workspaceId" = workspace_id AND m."userId" = auth.uid()::text
    )
  )
);

-- Channel Members Policies
DROP POLICY IF EXISTS channel_members_select ON public.channel_members;
CREATE POLICY channel_members_select ON public.channel_members FOR SELECT USING (
  member_id = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.channel_members cm2
    WHERE cm2.channel_id = channel_id AND cm2.member_id = auth.uid()::text
  )
);

-- Messages Policies
DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.channel_members cm
    WHERE cm.channel_id = messages.channel_id AND cm.member_id = auth.uid()::text
  )
  OR EXISTS (
    SELECT 1 FROM public.channels ch
    WHERE ch.id = messages.channel_id AND ch.type = 'WORKSPACE'
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m."workspaceId" = ch.workspace_id AND m."userId" = auth.uid()::text
    )
  )
);

DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages FOR INSERT WITH CHECK (
  author_id = auth.uid()::text
  AND (
    EXISTS (
      SELECT 1 FROM public.channel_members cm
      WHERE cm.channel_id = messages.channel_id AND cm.member_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM public.channels ch
      WHERE ch.id = messages.channel_id AND ch.type = 'WORKSPACE'
      AND EXISTS (
        SELECT 1 FROM public.members m
        WHERE m."workspaceId" = ch.workspace_id AND m."userId" = auth.uid()::text
      )
    )
  )
);

-- Reactions Policies
DROP POLICY IF EXISTS reactions_select ON public.message_reactions;
CREATE POLICY reactions_select ON public.message_reactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.messages msg
    JOIN public.channel_members cm ON cm.channel_id = msg.channel_id AND cm.member_id = auth.uid()::text
    WHERE msg.id = message_reactions.message_id
  )
);

DROP POLICY IF EXISTS reactions_insert ON public.message_reactions;
CREATE POLICY reactions_insert ON public.message_reactions FOR INSERT WITH CHECK (
  member_id = auth.uid()::text
);

DROP POLICY IF EXISTS reactions_delete ON public.message_reactions;
CREATE POLICY reactions_delete ON public.message_reactions FOR DELETE USING (
  member_id = auth.uid()::text
);
