"use client";

import React, { useState, useMemo } from "react";
import { Plus, Shield, Search, History, Users } from "lucide-react";
import { useGetRoles } from "../api/use-get-roles";
import { Role } from "../types";
import { RoleMatrixEditor } from "./role-matrix-editor";
import { CreateRoleDialog } from "./create-role-dialog";
import { CloneRoleDialog } from "./clone-role-dialog";
import { DeleteRoleDialog } from "./delete-role-dialog";
import { RoleAuditHistory } from "./role-audit-history";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

interface RolesViewProps {
  workspaceId: string;
}

export const RolesView: React.FC<RolesViewProps> = ({ workspaceId }) => {
  const { data: roles = [], isLoading } = useGetRoles({ workspaceId });

  const [activeTab, setActiveTab] = useState<"roles" | "audit">("roles");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [searchRole, setSearchRole] = useState("");

  // Modals state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [cloneRoleTarget, setCloneRoleTarget] = useState<Role | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<Role | null>(null);

  const filteredRoles = useMemo(() => {
    const q = searchRole.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [roles, searchRole]);

  // Ensure selected role exists or default to first
  const selectedRole = useMemo(() => {
    if (selectedRoleId) {
      const found = roles.find((r) => (r.id || r.$id) === selectedRoleId);
      if (found) return found;
    }
    return roles[0] || null;
  }, [roles, selectedRoleId]);

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Top Banner & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Shield className="size-6 text-indigo-600" />
            Roles & Permissions
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure granular permissions, organization levels, and custom roles for your workspace.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "roles" | "audit")}
            className="w-auto"
          >
            <TabsList>
              <TabsTrigger value="roles" className="text-xs gap-1.5">
                <Shield className="size-3.5" />
                Role Matrix
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs gap-1.5">
                <History className="size-3.5" />
                Audit Logs
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-4" />
            Create Role
          </Button>
        </div>
      </div>

      {activeTab === "roles" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[680px]">
          {/* Roles Selector Sidebar */}
          <div className="lg:col-span-4 flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search roles..."
                value={searchRole}
                onChange={(e) => setSearchRole(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {isLoading ? (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredRoles.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No roles match your search.
                </div>
              ) : (
                filteredRoles.map((r) => {
                  const rId = (r.id || r.$id) as string;
                  const isSelected = selectedRole && (selectedRole.id || selectedRole.$id) === rId;

                  return (
                    <button
                      key={rId}
                      type="button"
                      onClick={() => setSelectedRoleId(rId)}
                      className={`w-full text-left p-3 rounded-md transition border flex items-center justify-between gap-2 ${
                        isSelected
                          ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-xs"
                          : "bg-white dark:bg-neutral-900 border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="size-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: r.color || "#6366f1" }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs sm:text-sm truncate text-neutral-900 dark:text-neutral-100">
                              {r.name}
                            </span>
                            {r.isSystem && (
                              <span className="text-[10px] text-muted-foreground uppercase font-mono">
                                System
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Users className="size-3 inline" />
                            {r.memberCount || 0} member{r.memberCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 font-mono flex-shrink-0"
                      >
                        L{r.level}
                      </Badge>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Matrix Editor Main Panel */}
          <div className="lg:col-span-8 min-h-[600px]">
            {selectedRole ? (
              <RoleMatrixEditor
                key={selectedRole.id || selectedRole.$id}
                role={selectedRole}
                onClone={(r) => setCloneRoleTarget(r)}
                onDelete={(r) => setDeleteRoleTarget(r)}
              />
            ) : (
              <div className="h-full flex items-center justify-center border border-dashed rounded-lg p-12 text-muted-foreground">
                Select a role to view and edit its permissions.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="h-[700px]">
          <RoleAuditHistory workspaceId={workspaceId} />
        </div>
      )}

      {/* Dialogs */}
      <CreateRoleDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        workspaceId={workspaceId}
      />

      <CloneRoleDialog
        open={Boolean(cloneRoleTarget)}
        onOpenChange={(open) => !open && setCloneRoleTarget(null)}
        role={cloneRoleTarget}
      />

      <DeleteRoleDialog
        open={Boolean(deleteRoleTarget)}
        onOpenChange={(open) => !open && setDeleteRoleTarget(null)}
        role={deleteRoleTarget}
        allRoles={roles}
      />
    </div>
  );
};
