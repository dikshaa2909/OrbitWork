"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  GraduationCap,
  Users,
  FolderKanban,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  UserPlus,
  Download,
  MoreVertical,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DottedSeparator } from "@/components/dotted-separator";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/features/college/components/stat-card";
import { GroupProgressBadge } from "@/features/college/components/group-progress-badge";
import { InviteFacultyDialog } from "@/features/college/components/invite-faculty-dialog";
import { useGetBatches } from "@/features/college/api/use-get-batches";
import { useGetBatchOverview } from "@/features/college/api/use-get-batch-overview";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { getGroupProgress } from "@/features/college/utils";
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
  const [isExporting, setIsExporting] = useState(false);

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

  const attentionGroups = groups.filter((g) => {
    const progress = getGroupProgress(g);
    return progress.needsAttention;
  });

  const handleExportGradeSheet = async () => {
    if (!activeBatch?.id) {
      toast.error("No active academic batch found to export");
      return;
    }

    try {
      setIsExporting(true);
      toast.loading("Generating department grade sheet...", { id: "export-sheet" });
      const res = await fetch(`/api/college/batches/${activeBatch.id}/export-sheet`);
      if (!res.ok) throw new Error("Failed to export grade sheet");

      const json = await res.json();
      const rows = json.data || [];

      // Format as CSV
      const headers = ["Group Code", "Project Title", "Guide", "Lead", "Score", "Status"];
      const csvLines = [
        headers.join(","),
        ...rows.map(
          (r: {
            team_code?: string;
            project_title?: string;
            guide_name?: string;
            lead_name?: string;
            total_score?: number | null;
            status?: string;
          }) => [
            `"${r.team_code || ""}"`,
            `"${r.project_title || ""}"`,
            `"${r.guide_name || ""}"`,
            `"${r.lead_name || ""}"`,
            `"${r.total_score ?? "N/A"}"`,
            `"${r.status || "In Progress"}"`,
          ].join(",")
        ),
      ];

      const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Department_Grade_Sheet_${activeBatch.name || "Batch"}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Department grade sheet exported successfully!", { id: "export-sheet" });
    } catch {
      toast.error("Failed to export grade sheet", { id: "export-sheet" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner: Department Header & HOD Actions */}
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
            Department oversight engine monitoring active batches, faculty allocations, milestone progress, and final grading rubrics.
          </p>
        </div>

        {/* Strict HOD Actions: One Primary CTA + Secondary Kebab Menu */}
        <div className="flex items-center gap-2">
          {totalGroups > 0 && (
            <Button
              size="sm"
              onClick={() => setIsFacultyInviteOpen(true)}
              className="gap-1.5 shadow-sm bg-purple-600 hover:bg-purple-700 text-white font-medium"
            >
              <UserPlus className="size-4" />
              + Invite Faculty
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                title="More Actions"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem
                onClick={handleExportGradeSheet}
                disabled={isExporting || totalGroups === 0}
                className="gap-2 cursor-pointer"
              >
                <Download className="size-3.5" />
                Export Department Grade Sheet
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <Link href={`/workspaces/${workspaceId}/college`}>
                  <GraduationCap className="size-3.5" />
                  Manage Batches Hub
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Project Groups"
          value={totalGroups}
          subValue={activeBatch?.name || "Active Batch"}
          icon={FolderKanban}
          iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Active Guides"
          value={facultyCount}
          subValue="Supervising assigned groups"
          icon={GraduationCap}
          iconClassName="bg-purple-500/10 text-purple-600 dark:text-purple-400"
        />
        <StatCard
          label="Total Students"
          value={enrolledStudentsCount}
          subValue="Enrolled capstone students"
          icon={Users}
          iconClassName="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        />
        <StatCard
          label="Batch Progress"
          value={`${avgProgress}%`}
          subValue="Consolidated completion"
          icon={TrendingUp}
          iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* Attention Alert Board */}
      {attentionGroups.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                Needs Attention ({attentionGroups.length} Groups)
              </h3>
            </div>
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
              Review backlogs or pending guide allocations
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {attentionGroups.slice(0, 3).map((g) => {
              const prog = getGroupProgress(g);
              return (
                <div
                  key={g.team_id}
                  className="p-3 rounded-lg border border-amber-500/20 bg-background/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-foreground truncate">
                      {g.team_code} — {g.project_title}
                    </p>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                      {prog.statusText}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Canvas: Real-Time Table of All Groups */}
      <div className="p-5 rounded-2xl border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Department Progress Matrix
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live status, guide allocation, and delivery progression across all project groups.
            </p>
          </div>

          {groups.length > 5 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs shrink-0 text-primary font-medium" asChild>
              <Link href={`/workspaces/${workspaceId}/college?tab=teams`}>
                View All {totalGroups} Groups
                <ArrowRight className="size-3.5 ml-1.5" />
              </Link>
            </Button>
          )}
        </div>

        <DottedSeparator />

        {groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No project groups registered yet"
            description="Faculty guides create project groups and distribute student join codes. Once faculty register groups, their progress will appear here in real time."
            actionLabel="Invite Faculty Guides"
            onAction={() => setIsFacultyInviteOpen(true)}
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
                  <th className="py-2.5 px-3">Progress</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {groups.slice(0, 5).map((group) => {
                  const progress = getGroupProgress(group);

                  return (
                    <tr
                      key={group.team_id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-foreground whitespace-nowrap">
                        {group.team_code}
                      </td>
                      <td className="py-3 px-3 font-medium text-foreground max-w-[220px] truncate">
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
                      <td className="py-3 px-3 min-w-[130px]">
                        <GroupProgressBadge
                          percentage={progress.progressPercentage}
                          completedTasks={progress.completedTasks}
                          totalTasks={progress.totalTasks}
                        />
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" asChild>
                          <Link href={`/workspaces/${workspaceId}/college?tab=teams`}>
                            View Details →
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
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
      />
    </div>
  );
};
