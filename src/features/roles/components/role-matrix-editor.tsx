"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Save, Undo, Eye, Copy, Trash2, Shield, Lock, Check } from "lucide-react";
import { Role } from "../types";
import {
  PERMISSION_CATEGORIES,
  PERMISSIONS_CATALOG,
  PermissionCategory,
} from "@/lib/permissions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useUpdateRole } from "../api/use-update-role";
import { usePreviewRole } from "@/hooks/use-preview-role";

interface RoleMatrixEditorProps {
  role: Role;
  onClone: (role: Role) => void;
  onDelete: (role: Role) => void;
}

export const RoleMatrixEditor: React.FC<RoleMatrixEditorProps> = ({
  role,
  onClone,
  onDelete,
}) => {
  const roleId = role.id || (role.$id as string);
  const isOwnerRole = role.level === 0 || role.name.toLowerCase() === "owner";

  // Active permissions set in state
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(role.permissions || [])
  );
  const [search, setSearch] = useState("");
  const { setPreviewRole, previewRoleId } = usePreviewRole();
  const isCurrentlyPreviewed = previewRoleId === roleId;

  // Track unsaved changes
  const initialPermissions = useMemo(
    () => new Set(role.permissions || []),
    [role.permissions]
  );

  useEffect(() => {
    setSelectedPermissions(new Set(role.permissions || []));
  }, [role.permissions, roleId]);

  const hasUnsavedChanges = useMemo(() => {
    if (isOwnerRole) return false;
    if (selectedPermissions.size !== initialPermissions.size) return true;
    for (const key of Array.from(selectedPermissions)) {
      if (!initialPermissions.has(key)) return true;
    }
    return false;
  }, [selectedPermissions, initialPermissions, isOwnerRole]);

  const { mutate: updateRole, isPending } = useUpdateRole();

  const handleToggle = (key: string) => {
    if (isOwnerRole) return;
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAllCategory = (catId: PermissionCategory, select: boolean) => {
    if (isOwnerRole) return;
    const catKeys = PERMISSIONS_CATALOG.filter((p) => p.category === catId).map(
      (p) => p.key
    );
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      for (const k of catKeys) {
        if (select) {
          next.add(k);
        } else {
          next.delete(k);
        }
      }
      return next;
    });
  };

  const handleDiscard = () => {
    setSelectedPermissions(new Set(initialPermissions));
  };

  const handleSave = () => {
    if (isOwnerRole) return;
    updateRole({
      param: { roleId },
      json: {
        permissions: Array.from(selectedPermissions),
      },
    });
  };

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PERMISSIONS_CATALOG;
    return PERMISSIONS_CATALOG.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm overflow-hidden">
      {/* Role Header */}
      <div className="p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4 bg-neutral-50/50 dark:bg-neutral-900/50">
        <div className="flex items-center gap-3">
          <div
            className="size-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: role.color || "#6366f1" }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {role.name}
              </h2>
              {role.isSystem && (
                <Badge variant="outline" className="text-xs font-normal">
                  System Role
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                Level {role.level}
              </Badge>
              <span className="text-xs text-muted-foreground">
                ({role.memberCount || 0} members assigned)
              </span>
            </div>
            {role.description && (
              <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
                {role.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isCurrentlyPreviewed ? "secondary" : "outline"}
            onClick={() => {
              if (isCurrentlyPreviewed) {
                setPreviewRole(null, null);
              } else {
                setPreviewRole(roleId, role.name);
              }
            }}
            className="gap-1.5 text-xs font-semibold"
          >
            <Eye className="size-3.5" />
            {isCurrentlyPreviewed ? "Stop Previewing" : "Preview as Role"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onClone(role)}
            className="gap-1.5 text-xs"
          >
            <Copy className="size-3.5" />
            Clone
          </Button>

          {!role.isSystem && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(role)}
              className="gap-1.5 text-xs"
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Owner Notice or System Role Notice */}
      {isOwnerRole ? (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 p-3.5 px-6 flex items-center gap-3 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
          <Lock className="size-4 flex-shrink-0" />
          <span>
            <strong>Absolute Authority:</strong> Workspace Owner has permanent, unrestricted access to all actions and resources. Owner permissions cannot be modified.
          </span>
        </div>
      ) : role.isSystem ? (
        <div className="bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900 p-3 px-6 flex items-center gap-3 text-blue-900 dark:text-blue-200 text-xs">
          <Shield className="size-4 flex-shrink-0" />
          <span>
            This is a system role template. Edits made here will take effect for all members with this role.
          </span>
        </div>
      ) : null}

      {/* Search and Action Bar */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search permissions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs sm:text-sm"
          />
        </div>

        {hasUnsavedChanges && (
          <div className="flex items-center gap-2 animate-in fade-in duration-200">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              Unsaved changes
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDiscard}
              disabled={isPending}
              className="h-8 text-xs gap-1"
            >
              <Undo className="size-3.5" />
              Discard
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending}
              className="h-8 text-xs gap-1 font-semibold"
            >
              <Save className="size-3.5" />
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </div>

      {/* Permission Categories List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
        {PERMISSION_CATEGORIES.map((category) => {
          const categoryPermissions = filteredCatalog.filter(
            (p) => p.category === category.id
          );
          if (categoryPermissions.length === 0) return null;

          const allCategorySelected =
            !isOwnerRole &&
            categoryPermissions.every((p) => selectedPermissions.has(p.key));

          return (
            <div
              key={category.id}
              className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900"
            >
              {/* Category Header */}
              <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 sm:px-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                    {category.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {category.description}
                  </p>
                </div>

                {!isOwnerRole && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleSelectAllCategory(category.id, !allCategorySelected)
                      }
                      className="text-xs h-7 text-muted-foreground hover:text-foreground"
                    >
                      {allCategorySelected ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Items Grid */}
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {categoryPermissions.map((perm) => {
                  const isChecked = isOwnerRole || selectedPermissions.has(perm.key);
                  return (
                    <label
                      key={perm.key}
                      className={`flex items-start gap-3 p-3 sm:p-4 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30 transition cursor-pointer select-none ${
                        isOwnerRole ? "cursor-default" : ""
                      }`}
                    >
                      <div className="pt-0.5">
                        <Checkbox
                          checked={isChecked}
                          disabled={isOwnerRole}
                          onCheckedChange={() => handleToggle(perm.key)}
                        />
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                            {perm.name}
                          </span>
                          <code className="text-[10px] text-muted-foreground bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded font-mono">
                            {perm.key}
                          </code>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {perm.description}
                        </p>
                      </div>
                      {isChecked && (
                        <Check className="size-4 text-emerald-500 self-center hidden sm:block" />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
