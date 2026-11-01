"use client";

import { usePathname } from "next/navigation";

import dynamic from "next/dynamic";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useCollegePersona } from "@/features/college/hooks/use-college-persona";

import { UserButton } from "@/features/auth/components/user-button";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";

const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((mod) => mod.CommandPalette),
  {
    ssr: false,
    loading: () => (
      <div className="h-9 w-40 bg-muted/30 rounded-md animate-pulse hidden md:block" />
    ),
  }
);

import { MobileSidebar } from "./mobile-sidebar";

const pathnameMap = {
  "tasks": {
    title: "My Tasks",
    description: "View all of your tasks here",
  },
  "projects": {
    title: "My Project",
    description: "View tasks of your project here"
  },
  "college": {
    title: "Academic Project Management",
    description: "Manage student batches, project registrations, and review defense cycles",
  },
  "members": {
    title: "Faculty & Members Directory",
    description: "View workspace members, assign roles, and manage permissions",
  },
  "chat": {
    title: "Team & Group Chat",
    description: "Real-time communication with mentors, faculty, and project teams",
  },
};

const defaultMap = {
  title: "Home",
  description: "Monitor all of your projects and tasks here",
};

export const Navbar = () => {
  const pathname = usePathname();
  const workspaceId = useWorkspaceId();
  const { data: workspace } = useGetWorkspace({ workspaceId });
  const { isHod, isGuide, isStudent, isTeamLead } = useCollegePersona(workspaceId);
  const isCollege = workspace?.type === "COLLEGE";

  const pathnameParts = pathname.split("/");
  const pathnameKey = pathnameParts[3] as keyof typeof pathnameMap;

  let { title, description } = pathnameMap[pathnameKey] || defaultMap;

  if (!pathnameKey && isCollege) {
    if (isStudent || isTeamLead) {
      title = "My Project Workspace";
      description = "Track your tasks, submit deliverables, and collaborate with your guide";
    } else if (isGuide && !isHod) {
      title = "Faculty Guide Operations";
      description = "Review student deliverables and evaluate defense presentations";
    } else {
      title = "Department Overview";
      description = "Academic batches, milestone oversight, and faculty evaluations";
    }
  }

  return (
    <nav className="pt-4 px-6 flex items-center justify-between">
      <div className="flex-col hidden lg:flex">
        <h1 className="text-2xl font-semibold">
          {title}
        </h1>
        <p className="text-muted-foreground">
          {description}
        </p>
      </div>
      <MobileSidebar />
      <div className="flex items-center gap-x-3">
        <CommandPalette />
        <ThemeToggle />
        <NotificationBell />
        <UserButton />
      </div>
    </nav>
  );
};
