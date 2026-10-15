"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CalendarIcon, PlusIcon, SettingsIcon, FolderKanban, CheckSquare, Users } from "lucide-react";

import { Task } from "@/features/tasks/types";
import { Member } from "@/features/members/types";
import { Project } from "@/features/projects/types";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { useGetWorkspaceAnalytics } from "@/features/workspaces/api/use-get-workspace-analytics";
import { usePermissions } from "@/hooks/use-permissions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Analytics } from "@/components/analytics";
import { PageLoader } from "@/components/page-loader";
import { Card, CardContent } from "@/components/ui/card";
import { DottedSeparator } from "@/components/dotted-separator";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { EmptyState } from "@/components/empty-state";
import { WorkspaceFallbackScreen } from "@/components/workspace-fallback-screen";
import { GuardedAction } from "@/components/guarded-action";
import { AwaitingPermissionsBanner } from "@/components/awaiting-permissions-banner";

export const WorkspaceIdClient = () => {
  const workspaceId = useWorkspaceId();

  const { data: analytics, isLoading: isLoadingAnalytics } = useGetWorkspaceAnalytics({ workspaceId });
  const { data: tasks, isLoading: isLoadingTasks } = useGetTasks({ workspaceId });
  const { data: projects, isLoading: isLoadingProjects } = useGetProjects({ workspaceId });
  const { data: members, isLoading: isLoadingMembers } = useGetMembers({ workspaceId });

  const isLoading =
    isLoadingAnalytics ||
    isLoadingTasks ||
    isLoadingProjects ||
    isLoadingMembers;

  if (isLoading) {
    return <PageLoader />
  }

  if (!analytics || !tasks || !projects || !members) {
    return (
      <WorkspaceFallbackScreen
        title="Workspace Not Accessible"
        message="You are no longer a member of this workspace, or it has been deleted."
      />
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      <AwaitingPermissionsBanner workspaceId={workspaceId} />
      <Analytics data={analytics} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TaskList data={tasks.documents} total={tasks.total} />
        <ProjectList data={projects.documents} total={projects.total} />
        <MembersList data={members.documents} total={members.total} />
      </div>
    </div>
  );
};

interface TaskListProps {
  data: Task[];
  total: number;
};

export const TaskList = ({ data, total }: TaskListProps) => {
  const workspaceId = useWorkspaceId();
  const { open: createTask } = useCreateTaskModal();
  const { canCreateTask } = usePermissions(workspaceId);

  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-muted rounded-lg p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">
            Tasks ({total})
          </p>
          <GuardedAction permission="tasks:create">
            <Button variant="muted" size="icon" onClick={createTask} title="Create Task">
              <PlusIcon className="size-4 text-neutral-400" />
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
                <li key={task.$id}>
                  <Link href={`/workspaces/${workspaceId}/tasks/${task.$id}`}>
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
};

export const ProjectList = ({ data, total }: ProjectListProps) => {
  const workspaceId = useWorkspaceId();
  const { open: createProject } = useCreateProjectModal();
  const { canCreateProject } = usePermissions(workspaceId);

  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">
            Projects ({total})
          </p>
          <GuardedAction permission="projects:create">
            <Button variant="secondary" size="icon" onClick={createProject} title="Create Project">
              <PlusIcon className="size-4 text-neutral-400" />
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
              <li key={project.$id}>
                <Link href={`/workspaces/${workspaceId}/projects/${project.$id}`}>
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
};

export const MembersList = ({ data, total }: MembersListProps) => {
  const workspaceId = useWorkspaceId();
  const { canManageMembers } = usePermissions(workspaceId);

  return (
    <div className="flex flex-col gap-y-4 col-span-1">
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">
            Members ({total})
          </p>
          <Button asChild variant="secondary" size="icon" title={canManageMembers ? "Manage Members" : "View Members"}>
            <Link href={`/workspaces/${workspaceId}/members`}>
              <SettingsIcon className="size-4 text-neutral-400" />
            </Link>
          </Button>
        </div>
        <DottedSeparator className="my-4" />
        {total === 0 ? (
          <EmptyState
            icon={Users}
            title="No members found"
            description="Invite teammates to start collaborating on tasks and projects."
            actionHref={`/workspaces/${workspaceId}/members`}
            actionLabel="View Members"
          />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((member) => (
              <li key={member.$id}>
                <Card className="shadow-none rounded-lg overflow-hidden border">
                  <CardContent className="p-3 flex flex-col items-center gap-y-1.5">
                    <MemberAvatar
                      className="size-12"
                      name={member.name}
                    />
                    <div className="flex flex-col items-center overflow-hidden w-full text-center">
                      <p className="text-sm font-medium truncate w-full">
                        {member.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate w-full">
                        {member.email}
                      </p>
                      {member.role && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] uppercase font-bold mt-1.5"
                        >
                          {member.role}
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
