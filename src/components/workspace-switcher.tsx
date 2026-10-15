"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RiAddCircleFill } from "react-icons/ri";
import { Plus, UserPlus } from "lucide-react";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetWorkspaces } from "@/features/workspaces/api/use-get-workspaces";
import { WorkspaceAvatar } from "@/features/workspaces/components/workspace-avatar";
import { useCreateWorkspaceModal } from "@/features/workspaces/hooks/use-create-workspace-modal";
import { usePermissions } from "@/hooks/use-permissions";
import { Badge } from "@/components/ui/badge";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const WorkspaceSwitcher = () => {
  const workspaceId = useWorkspaceId();
  const router = useRouter();
  const { data: workspaces } = useGetWorkspaces();
  const { open } = useCreateWorkspaceModal();
  const { role } = usePermissions(workspaceId);

  useEffect(() => {
    if (workspaceId) {
      try {
        localStorage.setItem("jira_last_workspace_id", workspaceId);
        document.cookie = `jira_last_workspace_id=${workspaceId}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {
        // ignore
      }
    }
  }, [workspaceId]);

  const onSelect = (value: string) => {
    if (value === "action:create") {
      open();
      return;
    }
    if (value === "action:join") {
      router.push("/workspaces/create?tab=join");
      return;
    }

    try {
      localStorage.setItem("jira_last_workspace_id", value);
      document.cookie = `jira_last_workspace_id=${value}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // ignore
    }
    router.push(`/workspaces/${value}`);
  };

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <p className="text-xs uppercase text-neutral-500 font-semibold tracking-wider">
            Workspaces
          </p>
          {role && (
            <Badge
              variant="secondary"
              className="text-[9px] uppercase font-bold tracking-tight py-0 px-1.5 h-4 bg-neutral-200/80 text-neutral-700"
            >
              {role}
            </Badge>
          )}
        </div>
        <RiAddCircleFill
          onClick={open}
          className="size-5 text-neutral-500 cursor-pointer hover:opacity-75 transition"
          title="Create Workspace"
        />
      </div>
      <Select onValueChange={onSelect} value={workspaceId}>
        <SelectTrigger className="w-full bg-neutral-200 font-medium p-1">
          <SelectValue placeholder="No workspace selected" />
        </SelectTrigger>
        <SelectContent>
          {workspaces?.documents.map((workspace) => (
            <SelectItem key={workspace.$id} value={workspace.$id}>
              <div className="flex justify-start items-center gap-3 font-medium">
                <WorkspaceAvatar name={workspace.name} image={workspace.imageUrl} />
                <span className="truncate">{workspace.name}</span>
              </div>
            </SelectItem>
          ))}
          <SelectSeparator className="my-1" />
          <SelectItem value="action:create" className="cursor-pointer text-primary font-medium">
            <div className="flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              <span>Create workspace</span>
            </div>
          </SelectItem>
          <SelectItem value="action:join" className="cursor-pointer font-medium text-neutral-700">
            <div className="flex items-center gap-2">
              <UserPlus className="size-4 text-neutral-500" />
              <span>Join workspace</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
