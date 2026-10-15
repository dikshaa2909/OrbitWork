"use client";

import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  MoreVertical,
  Bug,
  CheckSquare,
  Bookmark,
  Zap,
} from "lucide-react";

import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { snakeCaseToTitleCase } from "@/lib/utils";

import { TaskDate } from "./task-date";
import { TaskActions } from "./task-actions";
import { Task, TaskPriority, TaskType } from "../types";

const getTypeIcon = (type?: TaskType) => {
  switch (type) {
    case TaskType.BUG:
      return <Bug className="size-4 text-rose-500 mr-1.5 shrink-0" />;
    case TaskType.STORY:
      return <Bookmark className="size-4 text-emerald-500 mr-1.5 shrink-0" />;
    case TaskType.EPIC:
      return <Zap className="size-4 text-purple-500 mr-1.5 shrink-0" />;
    default:
      return <CheckSquare className="size-4 text-blue-500 mr-1.5 shrink-0" />;
  }
};

const getPriorityBadge = (priority?: TaskPriority) => {
  switch (priority) {
    case TaskPriority.URGENT:
      return (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-rose-500/15 text-rose-600 border border-rose-300 dark:border-rose-800">
          Urgent
        </span>
      );
    case TaskPriority.HIGH:
      return (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-600 border border-amber-300 dark:border-amber-800">
          High
        </span>
      );
    case TaskPriority.LOW:
      return (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-500/15 text-emerald-600 border border-emerald-300 dark:border-emerald-800">
          Low
        </span>
      );
    default:
      return (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-500/15 text-blue-600 border border-blue-300 dark:border-blue-800">
          Medium
        </span>
      );
  }
};

export const columns: ColumnDef<Task>[] = [
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.original.type;
      return (
        <div className="flex items-center text-xs font-medium">
          {getTypeIcon(type)}
          <span>{type || "TASK"}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Task Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const name = row.original.name;
      const storyPoints = row.original.storyPoints;

      return (
        <div className="flex items-center gap-x-2">
          <p className="line-clamp-1 font-medium">{name}</p>
          {storyPoints !== null && storyPoints !== undefined && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
              {storyPoints} pts
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "priority",
    header: "Priority",
    cell: ({ row }) => {
      const priority = row.original.priority;
      return getPriorityBadge(priority);
    },
  },
  {
    accessorKey: "project",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Project
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const project = row.original.project;

      return (
        <div className="flex items-center gap-x-2 text-sm font-medium">
          <ProjectAvatar
            className="size-6"
            name={project.name}
            image={project.imageUrl}
          />
          <p className="line-clamp-1">{project.name}</p>
        </div>
      );
    },
  },
  {
    accessorKey: "assignee",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Assignee
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const assignee = row.original.assignee;

      return (
        <div className="flex items-center gap-x-2 text-sm font-medium">
          <MemberAvatar
            className="size-6"
            fallbackClassName="text-xs"
            name={assignee.name}
          />
          <p className="line-clamp-1">{assignee.name}</p>
        </div>
      );
    },
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Due Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const dueDate = row.original.dueDate;
      return <TaskDate value={dueDate} />;
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const status = row.original.status;
      return <Badge variant={status}>{snakeCaseToTitleCase(status)}</Badge>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const id = row.original.$id || row.original.id;
      const projectId = row.original.projectId;

      return (
        <TaskActions id={id} projectId={projectId} task={row.original}>
          <Button variant="ghost" className="size-8 p-0">
            <MoreVertical className="size-4" />
          </Button>
        </TaskActions>
      );
    },
  },
];
