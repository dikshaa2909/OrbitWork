"use client";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { Logo } from "./logo";
import { Projects } from "./projects";
import { Navigation } from "./navigation";
import { DottedSeparator } from "./dotted-separator";
import { WorkspaceSwitcher } from "./workspace-switcher";

export const Sidebar = () => {
  const workspaceId = useWorkspaceId();
  const { data: workspace } = useGetWorkspace({ workspaceId });
  const isCollege = workspace?.type === "COLLEGE";

  return (
    <aside className="h-full bg-neutral-100 dark:bg-neutral-900 border-r border-border p-4 w-full">
      <div className="px-2 pt-1 pb-2">
        <Logo size="md" href="/" />
      </div>
      <DottedSeparator className="my-4" />
      <WorkspaceSwitcher />
      <DottedSeparator className="my-4" />
      <Navigation />
      {!isCollege && (
        <>
          <DottedSeparator className="my-4" />
          <Projects />
        </>
      )}
    </aside>
  );
};
