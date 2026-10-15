-- ==============================================================================
-- JIRA CLONE - SUPABASE DATABASE MIGRATION SCRIPT
-- ==============================================================================
-- Run this complete script in the Supabase Dashboard -> SQL Editor -> New Query.
-- It will set up all tables, triggers, indexes, and storage buckets.
-- ==============================================================================

-- 1. Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. User Profiles Table (automatically synced with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger to sync auth.users with public.profiles on user creation/update
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Workspaces Table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  "imageUrl" TEXT,
  "inviteCode" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Members Table
CREATE TABLE IF NOT EXISTS public.members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  "imageUrl" TEXT,
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')),
  "workspaceId" TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  "projectId" TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  "assigneeId" TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 1000,
  "dueDate" TIMESTAMPTZ NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_userId ON public.workspaces("userId");
CREATE INDEX IF NOT EXISTS idx_members_workspaceId ON public.members("workspaceId");
CREATE INDEX IF NOT EXISTS idx_members_userId ON public.members("userId");
CREATE INDEX IF NOT EXISTS idx_projects_workspaceId ON public.projects("workspaceId");
CREATE INDEX IF NOT EXISTS idx_tasks_workspaceId ON public.tasks("workspaceId");
CREATE INDEX IF NOT EXISTS idx_tasks_projectId ON public.tasks("projectId");
CREATE INDEX IF NOT EXISTS idx_tasks_assigneeId ON public.tasks("assigneeId");
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON public.tasks(created_at);

-- 8. Storage Bucket for Workspace & Project Image Uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Bucket Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Public Access to Images'
  ) THEN
    CREATE POLICY "Public Access to Images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Authenticated uploads to images'
  ) THEN
    CREATE POLICY "Authenticated uploads to images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Service role full access to images'
  ) THEN
    CREATE POLICY "Service role full access to images"
    ON storage.objects FOR ALL
    TO service_role
    USING (bucket_id = 'images');
  END IF;
END $$;

