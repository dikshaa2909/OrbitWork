# OrbitWork (Next.js 14 + Supabase)

A high-performance project management platform with sprint tracking, granular RBAC, and seamless team collaboration built with Next.js 14 App Router, Hono API routes, Supabase (PostgreSQL + Auth + Storage), TanStack React Query, Tailwind CSS, and Radix UI.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+ or v20+) or **Bun** (v1.0+)
- A free **[Supabase](https://supabase.com)** account

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase project credentials in `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase Credentials (found in Supabase Dashboard -> Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

---

## 🗄️ Setting Up Supabase Database

1. Open your project on **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. In the left sidebar, click **SQL Editor** -> **New query**.
3. Open `supabase/schema.sql` from this repository, copy the entire SQL script, paste it into the editor, and click **Run**.
4. This script automatically sets up:
   - `profiles` table synced with `auth.users` via trigger
   - `workspaces` table
   - `members` table
   - `projects` table
   - `tasks` table
   - Performance indexes
   - `images` storage bucket with public access policies

---

## 🔐 Supabase Auth Settings (Recommended)

1. In Supabase Dashboard, go to **Authentication** -> **Providers** -> **Email**.
2. If you are developing locally, disable **Confirm email** so users can sign in immediately upon registering.
3. (Optional) Under **Providers**, enable **GitHub** or **Google** OAuth and add `http://localhost:3000/oauth` to your Redirect URLs under **Authentication** -> **URL Configuration**.

---

## 💻 Running the Development Server

Run the development server using Bun or npm:

```bash
bun dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Building for Production

```bash
bun run build
# or
npm run build
```
# thumpsup
# thumpsup
# thumpsup
# thumpsup
