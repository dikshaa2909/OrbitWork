"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Network, UserCheck } from "lucide-react";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUpdateMember } from "@/features/members/api/use-update-member";
import { HierarchyMember } from "../api/use-get-hierarchy";

interface OrgChartTreeProps {
  members: HierarchyMember[];
  workspaceId: string;
}

interface TreeNode {
  member: HierarchyMember;
  directReports: TreeNode[];
}

export const OrgChartTree: React.FC<OrgChartTreeProps> = ({ members }) => {
  const { mutate: updateMember, isPending } = useUpdateMember();

  // Build tree from reportsToId
  const { rootNodes, unassignedNodes } = useMemo(() => {
    const memberMap = new Map<string, HierarchyMember>();
    const childrenMap = new Map<string, string[]>();

    for (const m of members) {
      const mId = m.id || m.$id;
      memberMap.set(mId, m);
      if (m.reportsToId) {
        const arr = childrenMap.get(m.reportsToId) || [];
        arr.push(mId);
        childrenMap.set(m.reportsToId, arr);
      }
    }

    const buildNode = (memberId: string, visited = new Set<string>()): TreeNode => {
      visited.add(memberId);
      const member = memberMap.get(memberId)!;
      const childIds = childrenMap.get(memberId) || [];
      const directReports = childIds
        .filter((cId) => !visited.has(cId) && memberMap.has(cId))
        .map((cId) => buildNode(cId, new Set(visited)));
      return { member, directReports };
    };

    const roots: TreeNode[] = [];
    const unassigned: HierarchyMember[] = [];

    // Find roots: members who don't report to anyone or are owner
    for (const m of members) {
      const mId = m.id || m.$id;
      if (!m.reportsToId) {
        roots.push(buildNode(mId));
      } else if (!memberMap.has(m.reportsToId)) {
        // Manager not found
        unassigned.push(m);
      }
    }

    return { rootNodes: roots, unassignedNodes: unassigned };
  }, [members]);

  const handleChangeManager = (memberId: string, newReportsToId: string | null) => {
    updateMember({
      param: { memberId },
      json: { reportsToId: newReportsToId },
    });
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Network className="size-5 text-indigo-600" />
            Reporting Hierarchy & Line of Command
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visualize reporting structures, supervisor relationships, and organization levels across your workspace.
          </p>
        </div>
      </div>

      {rootNodes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No members found in this workspace.
        </div>
      ) : (
        <div className="space-y-6">
          {rootNodes.map((root) => (
            <OrgTreeNodeItem
              key={root.member.id || root.member.$id}
              node={root}
              allMembers={members}
              onChangeManager={handleChangeManager}
              isPending={isPending}
            />
          ))}

          {unassignedNodes.length > 0 && (
            <div className="mt-8 pt-6 border-t border-dashed">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
                Unassigned / Standalone Members ({unassignedNodes.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {unassignedNodes.map((m) => {
                  const mId = m.id || m.$id;
                  return (
                    <div
                      key={mId}
                      className="p-3 border rounded-lg flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/30"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MemberAvatar name={m.name || m.email} className="size-7 text-xs" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{m.name || m.email}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{m.role}</p>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 text-xs font-normal">
                            Assign Manager
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel className="text-xs">Select Supervisor</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {members
                            .filter((cand) => (cand.id || cand.$id) !== mId)
                            .map((cand) => (
                              <DropdownMenuItem
                                key={cand.id || cand.$id}
                                onClick={() => handleChangeManager(mId, cand.id || cand.$id)}
                                className="text-xs"
                              >
                                {cand.name || cand.email} ({cand.role})
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface OrgTreeNodeItemProps {
  node: TreeNode;
  allMembers: HierarchyMember[];
  onChangeManager: (memberId: string, newReportsToId: string | null) => void;
  isPending: boolean;
  depth?: number;
}

const OrgTreeNodeItem: React.FC<OrgTreeNodeItemProps> = ({
  node,
  allMembers,
  onChangeManager,
  isPending,
  depth = 0,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const m = node.member;
  const mId = m.id || m.$id;
  const hasReports = node.directReports.length > 0;

  const eligibleManagers = allMembers.filter((cand) => (cand.id || cand.$id) !== mId);

  return (
    <div className="flex flex-col">
      {/* Node Box */}
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border transition duration-150 ${
          depth === 0
            ? "bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 shadow-xs"
            : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
        }`}
        style={{ marginLeft: `${depth * 28}px` }}
      >
        {/* Toggle */}
        {hasReports ? (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="size-6 flex items-center justify-center rounded hover:bg-neutral-200/50 dark:hover:bg-neutral-800 text-neutral-500"
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        ) : (
          <span className="size-6 flex items-center justify-center text-neutral-300 dark:text-neutral-700">
            &bull;
          </span>
        )}

        <MemberAvatar name={m.name || m.email || "M"} className="size-9 text-xs" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 truncate">
              {m.name || m.email}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              {m.role}
            </Badge>
            {hasReports && (
              <Badge variant="secondary" className="text-[10px] font-mono">
                {node.directReports.length} direct report{node.directReports.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
        </div>

        {/* Change Manager Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
            >
              <UserCheck className="size-3.5 mr-1" />
              Reporting Line
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">Set Direct Supervisor</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onChangeManager(mId, null)}
              className="text-xs font-semibold text-indigo-600"
            >
              Independent / No Manager (Root)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {eligibleManagers.map((cand) => {
              const candId = cand.id || cand.$id;
              const isCurrent = m.reportsToId === candId;
              return (
                <DropdownMenuItem
                  key={candId}
                  onClick={() => onChangeManager(mId, candId)}
                  className={`text-xs ${isCurrent ? "font-bold bg-neutral-100 dark:bg-neutral-800" : ""}`}
                >
                  {cand.name || cand.email} ({cand.role})
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children list */}
      {hasReports && !collapsed && (
        <div className="space-y-2 mt-2 border-l-2 border-neutral-100 dark:border-neutral-800 pl-1 ml-3">
          {node.directReports.map((child) => (
            <OrgTreeNodeItem
              key={child.member.id || child.member.$id}
              node={child}
              allMembers={allMembers}
              onChangeManager={onChangeManager}
              isPending={isPending}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
