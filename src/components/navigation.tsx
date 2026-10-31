"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  SettingsIcon,
  UsersIcon,
  ShieldCheck,
  Network,
  Key,
  MessageSquare,
  GraduationCap,
  Clock,
} from "lucide-react";
import { GoCheckCircle, GoCheckCircleFill, GoHome, GoHomeFill } from "react-icons/go";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { usePermissions } from "@/hooks/use-permissions";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useCollegePersona } from "@/features/college/hooks/use-college-persona";

import { cn } from "@/lib/utils";

interface RouteItem {
  label: string;
  href: string;
  icon: typeof GoHome;
  activeIcon: typeof GoHomeFill;
  permission?: "edit_workspace" | "manage_roles";
}

export const Navigation = () => {
  const workspaceId = useWorkspaceId();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: workspace } = useGetWorkspace({ workspaceId });
  const { canEditWorkspace, can } = usePermissions(workspaceId);
  const canManageRoles = can("roles:manage") || canEditWorkspace;

  const isCollege = workspace?.type === "COLLEGE";
  const { isHod, isGuide, isTeamLead, isStudent } = useCollegePersona(workspaceId);

  // Dynamic routes based on workspace archetype & academic persona
  let activeRoutes: RouteItem[] = [];

  if (isCollege) {
    if (isStudent || isTeamLead) {
      // Students and Student Team Leads: dedicated workspace & team chat
      activeRoutes = [
        {
          label: "My Project Workspace",
          href: "",
          icon: GoHome,
          activeIcon: GoHomeFill,
        },
        {
          label: "Group Chat",
          href: "/chat",
          icon: MessageSquare as unknown as typeof GoHome,
          activeIcon: MessageSquare as unknown as typeof GoHomeFill,
        },
      ];
    } else if (isGuide && !isHod) {
      // Faculty Guides: My Guided Groups, Reviews & Approvals, Team Chat
      activeRoutes = [
        {
          label: "My Guided Groups",
          href: "",
          icon: GoHome,
          activeIcon: GoHomeFill,
        },
        {
          label: "Reviews & Approvals",
          href: "/college",
          icon: Clock as unknown as typeof GoHome,
          activeIcon: Clock as unknown as typeof GoHomeFill,
        },
        {
          label: "Team Chat",
          href: "/chat",
          icon: MessageSquare as unknown as typeof GoHome,
          activeIcon: MessageSquare as unknown as typeof GoHomeFill,
        },
      ];
    } else {
      // HOD / Department Coordinator: Unified Academics Hub, Faculty Directory, Announcements & Settings
      activeRoutes = [
        {
          label: "Dashboard",
          href: "",
          icon: GoHome,
          activeIcon: GoHomeFill,
        },
        {
          label: "Academics Hub",
          href: "/college",
          icon: GraduationCap as unknown as typeof GoHome,
          activeIcon: GraduationCap as unknown as typeof GoHomeFill,
        },
        {
          label: "Faculty Directory",
          href: "/members",
          icon: UsersIcon as unknown as typeof GoHome,
          activeIcon: UsersIcon as unknown as typeof GoHomeFill,
        },
        {
          label: "Announcements & Chat",
          href: "/chat",
          icon: MessageSquare as unknown as typeof GoHome,
          activeIcon: MessageSquare as unknown as typeof GoHomeFill,
        },
        {
          label: "Settings",
          href: "/settings",
          icon: SettingsIcon as unknown as typeof GoHome,
          activeIcon: SettingsIcon as unknown as typeof GoHomeFill,
          permission: "edit_workspace",
        },
      ];
    }
  } else {
    activeRoutes = [
      {
        label: "Home",
          href: "",
          icon: GoHome,
          activeIcon: GoHomeFill,
        },
        {
          label: "My Tasks",
          href: "/tasks",
          icon: GoCheckCircle,
          activeIcon: GoCheckCircleFill,
        },
        {
          label: "Team Chat",
          href: "/chat",
          icon: MessageSquare as unknown as typeof GoHome,
          activeIcon: MessageSquare as unknown as typeof GoHomeFill,
        },
        {
          label: "Teams & Hierarchy",
          href: "/teams",
          icon: Network as unknown as typeof GoHome,
          activeIcon: Network as unknown as typeof GoHomeFill,
        },
        {
          label: "Members",
          href: "/members",
          icon: UsersIcon as unknown as typeof GoHome,
          activeIcon: UsersIcon as unknown as typeof GoHomeFill,
        },
        {
          label: "Roles & Permissions",
          href: "/settings/roles",
          icon: ShieldCheck as unknown as typeof GoHome,
          activeIcon: ShieldCheck as unknown as typeof GoHomeFill,
          permission: "manage_roles",
        },
        {
          label: "Access Requests",
          href: "/requests",
          icon: Key as unknown as typeof GoHome,
          activeIcon: Key as unknown as typeof GoHomeFill,
        },
        {
          label: "Settings",
          href: "/settings",
          icon: SettingsIcon as unknown as typeof GoHome,
          activeIcon: SettingsIcon as unknown as typeof GoHomeFill,
          permission: "edit_workspace",
        },
      ];
  }

  const filteredRoutes = activeRoutes.filter((item) => {
    if (item.permission === "edit_workspace") {
      return canEditWorkspace;
    }
    if (item.permission === "manage_roles") {
      return canManageRoles;
    }
    return true;
  });

  return (
    <ul className="flex flex-col">
      {filteredRoutes.map((item) => {
        const fullHref = `/workspaces/${workspaceId}${item.href}`;
        const hasQuery = item.href.includes("?");
        const [basePath, queryString] = item.href.split("?");
        const fullBasePath = `/workspaces/${workspaceId}${basePath}`;

        let isActive = false;
        if (item.href === "") {
          isActive = pathname === fullHref;
        } else if (hasQuery) {
          const itemTab = new URLSearchParams(queryString).get("tab");
          isActive = pathname === fullBasePath && searchParams?.get("tab") === itemTab;
        } else {
          const currentTab = searchParams?.get("tab");
          isActive =
            pathname === fullBasePath &&
            (!currentTab || currentTab === "overview" || currentTab === "teams");
        }

        const Icon = isActive ? item.activeIcon : item.icon;
        
        return (
          <Link key={item.href} href={fullHref}>
            <div className={cn(
              "flex items-center gap-2.5 p-2.5 rounded-md font-medium transition text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-neutral-100",
              isActive && "bg-white dark:bg-neutral-800 shadow-sm hover:opacity-100 text-primary dark:text-neutral-100 font-semibold"
            )}>
              <Icon className={cn("size-5", isActive ? "text-primary dark:text-neutral-100" : "text-neutral-500 dark:text-neutral-400")} />
              {item.label}
            </div>
          </Link>
        )
      })}
    </ul>
  );
};
