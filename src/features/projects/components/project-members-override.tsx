"use client";

import React, { useState } from "react";
import { UserCheck, Plus, Trash2, Shield, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { useGetProjectMembers } from "../api/use-get-project-members";
import { useAssignProjectMember } from "../api/use-assign-project-member";
import { useRemoveProjectMember } from "../api/use-remove-project-member";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetRoles } from "@/features/roles/api/use-get-roles";

interface ProjectMembersOverrideProps {
  projectId: string;
  workspaceId: string;
}

export const ProjectMembersOverride: React.FC<ProjectMembersOverrideProps> = ({
  projectId,
  workspaceId,
}) => {
  const { data: projectMembers = [], isLoading } = useGetProjectMembers({ projectId });
  const { data: workspaceMembersData } = useGetMembers({ workspaceId });
  const { data: roles = [] } = useGetRoles({ workspaceId });

  const allWorkspaceMembers = workspaceMembersData?.documents || [];

  const [selectedMemberId, setSelectedMemberId] = useState<string>("NONE");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("NONE");

  const { mutate: assignMember, isPending: isAssigning } = useAssignProjectMember();
  const { mutate: removeMember, isPending: isRemoving } = useRemoveProjectMember();

  const handleAssign = () => {
    if (selectedMemberId === "NONE" || selectedRoleId === "NONE") return;

    assignMember(
      {
        param: { projectId },
        json: { memberId: selectedMemberId, roleId: selectedRoleId },
      },
      {
        onSuccess: () => {
          setSelectedMemberId("NONE");
          setSelectedRoleId("NONE");
        },
      }
    );
  };

  const handleRemove = (memberId: string) => {
    removeMember({
      param: { projectId, memberId },
    });
  };

  return (
    <Card className="w-full border-none shadow-none">
      <CardHeader className="flex flex-row items-center gap-x-4 p-7 space-y-0">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <UserCheck className="size-5 text-indigo-600" />
            Project Member Role Overrides
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            Grant elevated or scoped project roles to specific workspace members for this project only.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="p-7 pt-0 space-y-6">
        {/* Assign Override Form */}
        <div className="bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
            Add or Update Role Override
          </span>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="w-full sm:flex-1 text-xs">
                <SelectValue placeholder="Select workspace member..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Select member</SelectItem>
                {allWorkspaceMembers.map((m) => {
                  const mId = (m.id || m.$id) as string;
                  return (
                    <SelectItem key={mId} value={mId}>
                      {m.name || m.email} (Org: {m.role})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger className="w-full sm:flex-1 text-xs">
                <SelectValue placeholder="Select project role..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Select role</SelectItem>
                {roles.map((r) => {
                  const rId = (r.id || r.$id) as string;
                  return (
                    <SelectItem key={rId} value={rId}>
                      {r.name} (L{r.level})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              onClick={handleAssign}
              disabled={selectedMemberId === "NONE" || selectedRoleId === "NONE" || isAssigning}
              className="w-full sm:w-auto text-xs gap-1 font-semibold"
            >
              <Plus className="size-3.5" />
              {isAssigning ? "Saving..." : "Apply Override"}
            </Button>
          </div>
        </div>

        {/* Existing Overrides List */}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800 border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="size-4 animate-spin text-primary" />
              Loading project overrides...
            </div>
          ) : projectMembers.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No project-specific overrides configured. All workspace members inherit their workspace role.
            </div>
          ) : (
            projectMembers.map((pm) => {
              const mName = pm.member?.name || pm.member?.email || "Member";
              const rName = pm.role?.name || "Inherited";
              const rColor = pm.role?.color || "#6366f1";

              return (
                <div
                  key={pm.id}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition text-xs sm:text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MemberAvatar name={mName} className="size-8 text-xs" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate text-neutral-900 dark:text-neutral-100">
                          {mName}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[11px] gap-1 font-medium"
                          style={{
                            borderColor: rColor,
                          }}
                        >
                          <Shield className="size-3" style={{ color: rColor }} />
                          {rName}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {pm.member?.email} &bull; Workspace Role: <span className="uppercase">{pm.member?.role}</span>
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemove(pm.memberId)}
                    disabled={isRemoving}
                    className="text-muted-foreground hover:text-destructive h-8 px-2 text-xs gap-1"
                  >
                    <Trash2 className="size-3.5" />
                    <span className="hidden sm:inline">Remove Override</span>
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
