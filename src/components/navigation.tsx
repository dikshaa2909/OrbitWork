"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SettingsIcon,
  UsersIcon,
  ShieldCheck,
  Network,
  Key,
  MessageSquare,
  GraduationCap,
  Award,
} from "lucide-react";
import { GoCheckCircle, GoCheckCircleFill, GoHome, GoHomeFill } from "react-icons/go";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { usePermissions } from "@/hooks/use-permissions";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";

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
  const { data: workspace } = useGetWorkspace({ workspaceId });
  const { canEditWorkspace, can } = usePermissions(workspaceId);
  const canManageRoles = can("roles:manage") || canEditWorkspace;

  const isCollege = workspace?.type === "COLLEGE";

  // Dynamic routes based on workspace archetype
  const activeRoutes: RouteItem[] = isCollege
    ? [
        {
          label: "Dashboard",
          href: "",
          icon: GoHome,
          activeIcon: GoHomeFill,
        },
        {
          label: "Batches & Teams",
          href: "/college",
          icon: GraduationCap as unknown as typeof GoHome,
          activeIcon: GraduationCap as unknown as typeof GoHomeFill,
        },
        {
          label: "Milestones & Reviews",
          href: "/college?tab=milestones",
          icon: Award as unknown as typeof GoHome,
          activeIcon: Award as unknown as typeof GoHomeFill,
        },
        {
          label: "Team Chat",
          href: "/chat",
          icon: MessageSquare as unknown as typeof GoHome,
          activeIcon: MessageSquare as unknown as typeof GoHomeFill,
        },
        {
          label: "Members & Guides",
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
      ]
    : [
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
        const basePath = item.href.split("?")[0];
        const fullBasePath = `/workspaces/${workspaceId}${basePath}`;

        const isActive =
          item.href === ""
            ? pathname === fullHref
            : pathname === fullBasePath ||
              pathname.startsWith(`${fullBasePath}/`);

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
