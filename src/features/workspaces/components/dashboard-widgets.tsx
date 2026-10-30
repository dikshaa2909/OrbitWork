"use client";

import React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  CalendarIcon,
  PlusIcon,
  SettingsIcon,
  CheckSquare,
  FolderKanban,
  Users,
} from "lucide-react";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { usePermissions } from "@/hooks/use-permissions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DottedSeparator } from "@/components/dotted-separator";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { GuardedAction } from "@/components/guarded-action";
import { EmptyState } from "@/components/empty-state";

import { Task } from "@/features/tasks/types";
import { Project } from "@/features/projects/types";
import { Member } from "@/features/members/types";

interface TaskListProps {
  data: Task[];
  total: number;
}

export const TaskList = ({ data, total }: TaskListProps) => {
  const workspaceId = useWorkspaceId();
  const { open: createTask } = useCreateTaskModal();
  const { canCreateTask } = usePermissions(workspaceId);

  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-card border border-border rounded-lg p-4 text-card-foreground">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-foreground">
            Tasks ({total})
          </p>
          <GuardedAction permission="tasks:create">
            <Button variant="secondary" size="icon" onClick={createTask} title="Create Task">
              <PlusIcon className="size-4 text-muted-foreground" />
            </Button>
          </GuardedAction>
        </div>
        <DottedSeparator className="my-4" />
        {total === 0 ? (
          canCreateTask ? (
            <EmptyState
              icon={CheckSquare}
              title="No tasks yet"
              description="Create your first task to start tracking work for your team."
              actionLabel="Create Task"
              onAction={createTask}
            />
          ) : (
            <EmptyState
              icon={CheckSquare}
              title="No tasks yet"
              description="There are currently no tasks in this workspace."
            />
          )
        ) : (
          <>
            <ul className="flex flex-col gap-y-4">
              {data.map((task) => (
                <li key={task.$id || task.id}>
                  <Link href={`/workspaces/${workspaceId}/tasks/${task.$id || task.id}`}>
                    <Card className="shadow-none rounded-lg hover:opacity-75 transition">
                      <CardContent className="p-4">
                        <p className="text-lg font-medium truncate">{task.name}</p>
                        <div className="flex items-center gap-x-2">
                          <p>{task.project?.name}</p>
                          <div className="size-1 rounded-full bg-neutral-300" />
                          <div className="text-sm text-muted-foreground flex items-center">
                            <CalendarIcon className="size-3 mr-1" />
                            <span className="truncate">
                              {formatDistanceToNow(new Date(task.dueDate))}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
            <Button variant="muted" className="mt-4 w-full" asChild>
              <Link href={`/workspaces/${workspaceId}/tasks`}>
                Show All
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

interface ProjectListProps {
  data: Project[];
  total: number;
}

export const ProjectList = ({ data, total }: ProjectListProps) => {
  const workspaceId = useWorkspaceId();
  const { open: createProject } = useCreateProjectModal();
  const { canCreateProject } = usePermissions(workspaceId);

  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-card border border-border rounded-lg p-4 text-card-foreground">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-foreground">
            Projects ({total})
          </p>
          <GuardedAction permission="projects:create">
            <Button variant="secondary" size="icon" onClick={createProject} title="Create Project">
              <PlusIcon className="size-4 text-muted-foreground" />
            </Button>
          </GuardedAction>
        </div>
        <DottedSeparator className="my-4" />
        {total === 0 ? (
          canCreateProject ? (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Projects help you organize tasks, sprints, and team goals."
              actionLabel="Create Project"
              onAction={createProject}
            />
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="No projects have been created in this workspace yet."
              hint="Ask a Project Manager or Admin to create a project."
            />
          )
        ) : (
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.map((project) => (
              <li key={project.$id || project.id}>
                <Link href={`/workspaces/${workspaceId}/projects/${project.$id || project.id}`}>
                  <Card className="shadow-none rounded-lg hover:opacity-75 transition">
                    <CardContent className="p-4 flex items-center gap-x-2.5">
                      <ProjectAvatar
                        className="size-12"
                        fallbackClassName="text-lg"
                        name={project.name}
                        image={project.imageUrl}
                      />
                      <p className="text-lg font-medium truncate">
                        {project.name}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

interface MembersListProps {
  data: Member[];
  total: number;
}

export const MembersList = ({ data, total }: MembersListProps) => {
  const workspaceId = useWorkspaceId();
  const { canManageMembers } = usePermissions(workspaceId);

  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-card border border-border rounded-lg p-4 text-card-foreground">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-foreground">
            Members ({total})
          </p>
          <Button asChild variant="secondary" size="icon" title={canManageMembers ? "Manage Members" : "View Members"}>
            <Link href={`/workspaces/${workspaceId}/members`}>
              <SettingsIcon className="size-4 text-muted-foreground" />
            </Link>
          </Button>
        </div>
        <DottedSeparator className="my-4" />
        {total === 0 ? (
          <EmptyState
            icon={Users}
            title="No members found"
            description="Invite teammates to start collaborating on tasks and projects."
            actionLabel={canManageMembers ? "Invite Members" : undefined}
            actionHref={`/workspaces/${workspaceId}/members`}
          />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((member) => (
              <li key={member.$id || member.id}>
                <Card className="shadow-none rounded-lg overflow-hidden border">
                  <CardContent className="p-3 flex flex-col items-center gap-y-2">
                    <MemberAvatar
                      className="size-12"
                      name={member.name}
                    />
                    <div className="flex flex-col items-center overflow-hidden w-full">
                      <p className="text-sm font-medium line-clamp-1">
                        {member.name}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {member.email}
                      </p>
                      {member.roleName && (
                        <Badge variant="outline" className="mt-1 text-[10px] font-semibold">
                          {member.roleName}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export const TaskListSkeleton = () => {
  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-card border border-border rounded-lg p-4 text-card-foreground">
        <div className="flex items-center justify-between">
          <div className="h-6 w-24 bg-muted animate-pulse rounded" />
          <div className="size-8 bg-muted animate-pulse rounded" />
        </div>
        <DottedSeparator className="my-4" />
        <div className="flex flex-col gap-y-3">
          {[1, 2, 3].map((item) => (
            <Card key={item} className="shadow-none rounded-lg border bg-background">
              <CardContent className="p-4 space-y-2">
                <div className="h-5 w-48 bg-muted animate-pulse rounded" />
                <div className="flex items-center gap-x-2">
                  <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  <div className="size-1 rounded-full bg-neutral-300" />
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ProjectListSkeleton = () => {
  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-card border border-border rounded-lg p-4 text-card-foreground">
        <div className="flex items-center justify-between">
          <div className="h-6 w-28 bg-muted animate-pulse rounded" />
          <div className="size-8 bg-muted animate-pulse rounded" />
        </div>
        <DottedSeparator className="my-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((item) => (
            <Card key={item} className="shadow-none rounded-lg border bg-background">
              <CardContent className="p-4 flex items-center gap-x-2.5">
                <div className="size-12 rounded-md bg-muted animate-pulse shrink-0" />
                <div className="h-5 w-28 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export const MembersListSkeleton = () => {
  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-card border border-border rounded-lg p-4 text-card-foreground">
        <div className="flex items-center justify-between">
          <div className="h-6 w-28 bg-muted animate-pulse rounded" />
          <div className="size-8 bg-muted animate-pulse rounded" />
        </div>
        <DottedSeparator className="my-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((item) => (
            <Card key={item} className="shadow-none rounded-lg border bg-background">
              <CardContent className="p-3 flex flex-col items-center gap-y-2">
                <div className="size-12 rounded-full bg-muted animate-pulse" />
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                <div className="h-3 w-28 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

