"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Search,
  CheckSquare,
  FolderKanban,
  Users,
  Settings,
  Shield,
  Layers,
  LayoutDashboard,
  PlusCircle,
  UserPlus,
  MessageSquare,
  GraduationCap,
  Award,
  CheckCircle2,
  LayoutGrid,
} from "lucide-react";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { Button } from "@/components/ui/button";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const workspaceId = useWorkspaceId();

  const { open: openCreateTask } = useCreateTaskModal();
  const { open: openCreateProject } = useCreateProjectModal();

  const { data: projectsData } = useGetProjects({
    workspaceId: workspaceId || "",
  });
  const projects = projectsData?.documents || [];

  const { data: tasksData } = useGetTasks({
    workspaceId: workspaceId || "",
  });
  const tasks = tasksData?.documents || [];

  const { data: workspace } = useGetWorkspace({
    workspaceId: workspaceId || "",
  });
  const isCollege = workspace?.type === "COLLEGE";

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 text-xs text-muted-foreground h-9 px-3 bg-muted/40 hover:bg-muted/80 rounded-md border"
      >
        <Search className="size-3.5" />
        <span>Search or command...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm ml-2">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="flex md:hidden size-9 p-0"
        title="Search"
      >
        <Search className="size-4" />
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-card text-card-foreground border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <Command
              loop
              className="w-full flex flex-col focus:outline-none"
            >
              <div className="flex items-center border-b px-3 bg-transparent">
                <Search className="mr-2 size-4 shrink-0 text-muted-foreground" />
                <Command.Input
                  autoFocus
                  placeholder="Type a command or search tasks, projects..."
                  className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <Command.List className="max-h-[350px] overflow-y-auto p-2 scrollbar-none">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  No matching results found.
                </Command.Empty>

                {/* Actions */}
                <Command.Group
                  heading="Quick Actions"
                  className="text-xs font-semibold text-muted-foreground px-2 py-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {isCollege ? (
                    <>
                      <Command.Item
                        onSelect={() =>
                          runCommand(() =>
                            router.push(
                              `/workspaces/${workspaceId}/college?tab=overview`
                            )
                          )
                        }
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                      >
                        <LayoutGrid className="size-4 text-emerald-500" />
                        <span>All Capstone Groups Matrix</span>
                      </Command.Item>
                      <Command.Item
                        onSelect={() =>
                          runCommand(() =>
                            router.push(
                              `/workspaces/${workspaceId}/college?tab=verify`
                            )
                          )
                        }
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                      >
                        <CheckCircle2 className="size-4 text-amber-500" />
                        <span>Guide Verification Queue</span>
                      </Command.Item>
                      <Command.Item
                        onSelect={() =>
                          runCommand(() =>
                            router.push(`/workspaces/${workspaceId}/college?tab=teams`)
                          )
                        }
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                      >
                        <GraduationCap className="size-4 text-blue-500" />
                        <span>Manage Batches & Teams</span>
                      </Command.Item>
                      <Command.Item
                        onSelect={() =>
                          runCommand(() =>
                            router.push(
                              `/workspaces/${workspaceId}/college?tab=milestones`
                            )
                          )
                        }
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                      >
                        <Award className="size-4 text-indigo-500" />
                        <span>Review Milestones & Rubrics</span>
                      </Command.Item>
                    </>
                  ) : (
                    <>
                      <Command.Item
                        onSelect={() =>
                          runCommand(() => openCreateTask())
                        }
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                      >
                        <PlusCircle className="size-4 text-indigo-500" />
                        <span>Create New Task</span>
                      </Command.Item>
                      <Command.Item
                        onSelect={() =>
                          runCommand(() => openCreateProject())
                        }
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                      >
                        <FolderKanban className="size-4 text-emerald-500" />
                        <span>Create New Project</span>
                      </Command.Item>
                    </>
                  )}
                  {workspaceId && (
                    <Command.Item
                      onSelect={() =>
                        runCommand(() =>
                          router.push(`/workspaces/${workspaceId}/members`)
                        )
                      }
                      className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                    >
                      <UserPlus className="size-4 text-blue-500" />
                      <span>Invite & Manage Members</span>
                    </Command.Item>
                  )}
                </Command.Group>

                {/* Navigation */}
                {workspaceId && (
                  <Command.Group
                    heading="Navigation"
                    className="text-xs font-semibold text-muted-foreground px-2 py-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    <Command.Item
                      onSelect={() =>
                        runCommand(() =>
                          router.push(`/workspaces/${workspaceId}`)
                        )
                      }
                      className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                    >
                      <LayoutDashboard className="size-4" />
                      <span>Workspace Dashboard</span>
                    </Command.Item>
                    <Command.Item
                      onSelect={() =>
                        runCommand(() =>
                          router.push(`/workspaces/${workspaceId}/tasks`)
                        )
                      }
                      className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                    >
                      <CheckSquare className="size-4" />
                      <span>Tasks & Kanban</span>
                    </Command.Item>
                    <Command.Item
                      onSelect={() =>
                        runCommand(() =>
                          router.push(`/workspaces/${workspaceId}/chat`)
                        )
                      }
                      className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                    >
                      <MessageSquare className="size-4" />
                      <span>Team Chat</span>
                    </Command.Item>
                    <Command.Item
                      onSelect={() =>
                        runCommand(() =>
                          router.push(`/workspaces/${workspaceId}/teams`)
                        )
                      }
                      className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                    >
                      <Users className="size-4" />
                      <span>Teams & Organization Chart</span>
                    </Command.Item>
                    <Command.Item
                      onSelect={() =>
                        runCommand(() =>
                          router.push(`/workspaces/${workspaceId}/requests`)
                        )
                      }
                      className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                    >
                      <Shield className="size-4" />
                      <span>Access Requests</span>
                    </Command.Item>
                    <Command.Item
                      onSelect={() =>
                        runCommand(() =>
                          router.push(
                            `/workspaces/${workspaceId}/settings/roles`
                          )
                        )
                      }
                      className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                    >
                      <Layers className="size-4" />
                      <span>Roles & Permissions Matrix</span>
                    </Command.Item>
                    <Command.Item
                      onSelect={() =>
                        runCommand(() =>
                          router.push(`/workspaces/${workspaceId}/settings`)
                        )
                      }
                      className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                    >
                      <Settings className="size-4" />
                      <span>Workspace Settings</span>
                    </Command.Item>
                  </Command.Group>
                )}

                {/* Projects */}
                {projects.length > 0 && workspaceId && (
                  <Command.Group
                    heading="Projects"
                    className="text-xs font-semibold text-muted-foreground px-2 py-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {projects.map((project) => {
                      const pId = project.$id || project.id;
                      return (
                        <Command.Item
                          key={pId}
                          value={`project ${project.name}`}
                          onSelect={() =>
                            runCommand(() =>
                              router.push(
                                `/workspaces/${workspaceId}/projects/${pId}`
                              )
                            )
                          }
                          className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                        >
                          <ProjectAvatar
                            name={project.name}
                            image={project.imageUrl}
                            className="size-5"
                          />
                          <span className="truncate">{project.name}</span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}

                {/* Tasks */}
                {tasks.length > 0 && workspaceId && (
                  <Command.Group
                    heading="Tasks"
                    className="text-xs font-semibold text-muted-foreground px-2 py-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {tasks.slice(0, 15).map((task) => {
                      const tId = task.$id || task.id;
                      return (
                        <Command.Item
                          key={tId}
                          value={`task ${task.name} ${task.status}`}
                          onSelect={() =>
                            runCommand(() =>
                              router.push(
                                `/workspaces/${workspaceId}/tasks/${tId}`
                              )
                            )
                          }
                          className="relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <CheckSquare className="size-4 text-muted-foreground shrink-0" />
                            <span className="truncate">{task.name}</span>
                          </div>
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground shrink-0 px-1.5 py-0.5 rounded bg-muted">
                            {task.status.replace(/_/g, " ")}
                          </span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}
              </Command.List>

              <div className="border-t px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground bg-muted/20">
                <div className="flex items-center gap-3">
                  <span>
                    <kbd className="font-mono bg-muted px-1 py-0.5 rounded border text-[10px]">
                      ↑
                    </kbd>{" "}
                    <kbd className="font-mono bg-muted px-1 py-0.5 rounded border text-[10px]">
                      ↓
                    </kbd>{" "}
                    to navigate
                  </span>
                  <span>
                    <kbd className="font-mono bg-muted px-1 py-0.5 rounded border text-[10px]">
                      ↵
                    </kbd>{" "}
                    to select
                  </span>
                </div>
                <span>
                  <kbd className="font-mono bg-muted px-1 py-0.5 rounded border text-[10px]">
                    ESC
                  </kbd>{" "}
                  to close
                </span>
              </div>
            </Command>
          </div>
        </div>
      )}
    </>
  );
}
