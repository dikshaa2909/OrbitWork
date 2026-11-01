"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiAddCircleFill } from "react-icons/ri";

import { cn } from "@/lib/utils";

import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { usePermissions } from "@/hooks/use-permissions";

export const Projects = () => {
  const pathname = usePathname();
  const { open } = useCreateProjectModal();
  const workspaceId = useWorkspaceId();
  const { data: workspace, isLoading: isWorkspaceLoading } = useGetWorkspace({ workspaceId });
  const { canCreateProject } = usePermissions(workspaceId);
  const { data, isLoading } = useGetProjects({
    workspaceId,
  });

  const isCollege = workspace?.type === "COLLEGE";

  // Completely omit Projects section in College workspaces
  if (isWorkspaceLoading || isCollege) {
    return null;
  }

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase text-neutral-500">Projects</p>
        {canCreateProject && (
          <RiAddCircleFill
            onClick={open}
            className="size-5 text-neutral-500 cursor-pointer hover:opacity-75 transition"
            title="Create Project"
          />
        )}
      </div>
      {isLoading ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 p-2 rounded-md">
            <div className="size-6 rounded bg-neutral-200 animate-pulse shrink-0" />
            <div className="h-4 w-28 bg-neutral-200 animate-pulse rounded" />
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-md">
            <div className="size-6 rounded bg-neutral-200 animate-pulse shrink-0" />
            <div className="h-4 w-20 bg-neutral-200 animate-pulse rounded" />
          </div>
        </div>
      ) : (
        data?.documents.map((project) => {
          const href = `/workspaces/${workspaceId}/projects/${project.$id}`;
          const isActive = pathname === href;

          return (
            <Link href={href} key={project.$id}>
              <div
                className={cn(
                  "flex items-center gap-2.5 p-2.5 rounded-md hover:opacity-75 transition cursor-pointer text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-neutral-100",
                  isActive && "bg-white dark:bg-neutral-800 shadow-sm hover:opacity-100 text-primary dark:text-neutral-100 font-semibold"
                )}
              >
                <ProjectAvatar image={project.imageUrl} name={project.name} />
                <span className="truncate">{project.name}</span>
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
};
