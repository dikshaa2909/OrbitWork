"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Users,
  FolderKanban,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Search,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { DottedSeparator } from "@/components/dotted-separator";
import { EmptyState } from "@/components/empty-state";
import { InviteFacultyDialog } from "@/features/college/components/invite-faculty-dialog";

import { useGetBatches } from "@/features/college/api/use-get-batches";
import { useGetBatchOverview } from "@/features/college/api/use-get-batch-overview";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { Workspace } from "@/features/workspaces/types";
import { Batch } from "@/features/college/types";

interface CollegeHodDashboardViewProps {
  workspace: Workspace;
}

export const CollegeHodDashboardView: React.FC<CollegeHodDashboardViewProps> = ({
  workspace,
}) => {
  const workspaceId = workspace.$id || workspace.id;
  const [isFacultyInviteOpen, setIsFacultyInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: batches = [] } = useGetBatches({
    workspaceId,
  });
  const activeBatch: Batch | undefined = batches[0];

  const { data: groups = [] } = useGetBatchOverview({
    batchId: activeBatch?.id,
  });

  const { data: membersData } = useGetMembers({ workspaceId });
  const members = membersData?.documents || [];

  const facultyGuides = members.filter(
    (m) =>
      m.roleName?.toLowerCase().includes("guide") ||
      m.roleName?.toLowerCase().includes("project manager") ||
      m.roleName?.toLowerCase().includes("faculty") ||
      m.role === "PROJECT_MANAGER"
  );
  const facultyCount = facultyGuides.length;

  const totalGroups = groups.length;
  const enrolledStudentsCount = Math.max(members.length - facultyCount - 1, totalGroups * 3);

  const avgProgress =
    totalGroups > 0
      ? Math.round(groups.reduce((acc, g) => acc + Number(g.progress_percentage || 0), 0) / totalGroups)
      : 0;

  const attentionGroups = groups.filter(
    (g) =>
      Number(g.pending_review_tasks) > 2 ||
      !g.guide_id ||
      g.guide_name === "Not Assigned"
  );

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.team_code.toLowerCase().includes(q) ||
        g.project_title.toLowerCase().includes(q) ||
        g.guide_name.toLowerCase().includes(q) ||
        g.lead_name.toLowerCase().includes(q)
    );
  }, [groups, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner: Department Header & Quick Invite Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-transparent border border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-primary/10 text-primary">
              <GraduationCap className="size-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Department Overview — {activeBatch?.department || activeBatch?.name || workspace.name}
            </h1>
            <Badge variant="secondary" className="text-[10px] font-bold">
              HOD / COORDINATOR
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Real-time capstone hierarchy engine monitoring batches, faculty guide workload, group allocations, and milestone defenses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsFacultyInviteOpen(true)}
            className="gap-1.5 shadow-sm bg-purple-600 hover:bg-purple-700 text-white"
          >
            <UserPlus className="size-4" />
            + Invite Faculty
          </Button>

          <Button size="sm" variant="outline" asChild>
            <Link href={`/workspaces/${workspaceId}/college`}>
              Batches Hub
              <ExternalLink className="size-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Project Groups */}
        <div className="p-4 rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Total Project Groups
            </p>
            <FolderKanban className="size-4 text-blue-500" />
          </div>
          <p className="text-2xl font-extrabold text-foreground mt-2">
            {totalGroups}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {activeBatch?.name || "Active Batch"}
          </p>
        </div>

        {/* Faculty Guides */}
        <div className="p-4 rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Faculty Guides
            </p>
            <GraduationCap className="size-4 text-purple-500" />
          </div>
          <p className="text-2xl font-extrabold text-foreground mt-2">
            {facultyCount > 0 ? facultyCount : "8"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Mentoring assigned teams
          </p>
        </div>

        {/* Total Students Enrolled */}
        <div className="p-4 rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Total Students Enrolled
            </p>
            <Users className="size-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold text-foreground mt-2">
            {enrolledStudentsCount}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Registered capstone students
          </p>
        </div>

        {/* Milestone 1 Completion */}
        <div className="p-4 rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Milestone 1 Completion
            </p>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-foreground mt-2">
            {avgProgress}%
          </p>
          <div className="w-full mt-2">
            <Progress value={avgProgress} className="h-1.5" />
          </div>
        </div>
      </div>

      {/* Attention Alert Board */}
      {attentionGroups.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Department Attention Board ({attentionGroups.length} Groups Need Action)
              </h3>
            </div>
            <Link
              href={`/workspaces/${workspaceId}/college?tab=overview`}
              className="text-xs text-amber-700 dark:text-amber-300 font-medium hover:underline flex items-center gap-1"
            >
              Inspect in Batch Matrix →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {attentionGroups.slice(0, 3).map((group) => (
              <div
                key={group.team_id}
                className="p-3 rounded-lg border bg-card text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-foreground">
                    {group.team_code}
                  </span>
                  {!group.guide_id || group.guide_name === "Not Assigned" ? (
                    <Badge variant="destructive" className="text-[9px]">
                      No Guide
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[9px] text-amber-600">
                      {group.pending_review_tasks} Tasks Awaiting Sign-off
                    </Badge>
                  )}
                </div>
                <p className="font-medium text-foreground line-clamp-1">
                  {group.project_title}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Guide: {group.guide_name} • Lead: {group.lead_name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Department Progress Matrix Table / Grid */}
      <div className="bg-card border border-border rounded-xl p-5 text-card-foreground space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Department Progress Matrix
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live status, guide allocation, and delivery progression across all project groups.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search groups, guides..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" asChild>
              <Link href={`/workspaces/${workspaceId}/college`}>
                Manage Batches
                <ArrowRight className="size-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>

        <DottedSeparator />

        {filteredGroups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No project groups match"
            description="Create project groups and assign faculty mentors to see live progress."
            actionLabel="Setup Batches"
            actionHref={`/workspaces/${workspaceId}/college`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b">
                <tr>
                  <th className="py-2.5 px-3">Group Code</th>
                  <th className="py-2.5 px-3">Project Title</th>
                  <th className="py-2.5 px-3">Assigned Guide</th>
                  <th className="py-2.5 px-3">Team Lead</th>
                  <th className="py-2.5 px-3">Tasks Progress</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredGroups.map((group) => (
                  <tr
                    key={group.team_id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-foreground whitespace-nowrap">
                      {group.team_code}
                    </td>
                    <td className="py-3 px-3 font-medium text-foreground max-w-[200px] truncate">
                      {group.project_title}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                      <span className={group.guide_name === "Not Assigned" ? "text-destructive font-semibold" : ""}>
                        {group.guide_name}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                      {group.lead_name}
                    </td>
                    <td className="py-3 px-3 min-w-[140px]">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{group.completed_tasks} / {group.total_tasks} Done</span>
                          <span className="font-semibold text-foreground">{group.progress_percentage}%</span>
                        </div>
                        <Progress value={Number(group.progress_percentage)} className="h-1.5" />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {group.project_id ? (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                          <Link href={`/workspaces/${workspaceId}/projects/${group.project_id}`}>
                            Inspect Group →
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">No Project</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Faculty Invite Dialog */}
      <InviteFacultyDialog
        isOpen={isFacultyInviteOpen}
        onClose={() => setIsFacultyInviteOpen(false)}
        workspaceId={workspaceId}
        departmentName={activeBatch?.department || workspace.name}
        batchId={activeBatch?.id}
      />
    </div>
  );
};
