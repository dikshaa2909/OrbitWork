"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SettingsIcon, UsersIcon, ShieldCheck, Network, Key } from "lucide-react";
import { GoCheckCircle, GoCheckCircleFill, GoHome, GoHomeFill } from "react-icons/go";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { usePermissions } from "@/hooks/use-permissions";

import { cn } from "@/lib/utils";

interface RouteItem {
  label: string;
  href: string;
  icon: typeof GoHome;
  activeIcon: typeof GoHomeFill;
  permission?: "edit_workspace" | "manage_roles";
}

const routes: RouteItem[] = [
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

export const Navigation = () => {
  const workspaceId = useWorkspaceId();
  const pathname = usePathname();
  const { canEditWorkspace, can } = usePermissions(workspaceId);
  const canManageRoles = can("roles:manage") || canEditWorkspace;

  const filteredRoutes = routes.filter((item) => {
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
        const fullHref = `/workspaces/${workspaceId}${item.href}`
        const isActive = pathname === fullHref;
        const Icon = isActive ? item.activeIcon : item.icon;
        
        return (
          <Link key={item.href} href={fullHref}>
            <div className={cn(
              "flex items-center gap-2.5 p-2.5 rounded-md font-medium hover:text-primary transition text-neutral-500",
              isActive && "bg-white shadow-sm hover:opacity-100 text-primary"
            )}>
              <Icon className="size-5 text-neutral-500" />
              {item.label}
            </div>
          </Link>
        )
      })}
    </ul>
  );
};
