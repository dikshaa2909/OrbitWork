"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  GraduationCap,
  ExternalLink,
  Search,
  LayoutGrid,
  List as ListIcon,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useGetBatchOverview } from "../api/use-get-batch-overview";
import { Batch } from "../types";

interface BatchOverviewTabProps {
  batch: Batch;
  workspaceId: string;
  currentUserId?: string;
  isHod: boolean;
  onOpenVerificationQueue: () => void;
}

export const BatchOverviewTab: React.FC<BatchOverviewTabProps> = ({
  batch,
  workspaceId,
  currentUserId,
  isHod,
  onOpenVerificationQueue,
}) => {
  const { data: groups = [], isLoading } = useGetBatchOverview({
    batchId: batch.id,
  });

  const [filterMode, setFilterMode] = useState<"ALL" | "MY_GROUPS" | "NEEDS_ATTENTION">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"GRID" | "LIST">("GRID");

  const filteredGroups = groups.filter((g) => {
    // Search filter
    const matchesSearch =
      g.team_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.project_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.lead_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.guide_name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterMode === "MY_GROUPS") {
      return g.guide_id === currentUserId;
    }

    if (filterMode === "NEEDS_ATTENTION") {
      // Stalled or has multiple tasks pending review
      return g.pending_review_tasks > 0 || (g.total_tasks > 0 && g.progress_percentage < 30);
    }

    return true;
  });

  const totalPendingReview = groups.reduce((acc, curr) => acc + curr.pending_review_tasks, 0);
  const avgProgress =
    groups.length > 0
      ? Math.round(groups.reduce((acc, curr) => acc + Number(curr.progress_percentage), 0) / groups.length)
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Department Analytics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border bg-card flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Capstone Groups
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-2xl font-extrabold text-foreground mt-1">
                {groups.length} Groups
              </p>
              {isHod && (
                <Badge variant="secondary" className="text-[10px] mt-1 font-semibold">
                  HOD View
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {batch.name}
            </p>
          </div>
          <div className="size-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <FolderKanban className="size-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Batch Progress Avg
            </p>
            <p className="text-2xl font-extrabold text-foreground mt-1">
              {avgProgress}%
            </p>
            <div className="w-28 mt-1.5">
              <Progress value={avgProgress} className="h-1.5" />
            </div>
          </div>
          <div className="size-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="size-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Pending Guide Sign-Off
            </p>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-500 mt-1">
              {totalPendingReview} Tasks
            </p>
            {totalPendingReview > 0 ? (
              <button
                type="button"
                onClick={onOpenVerificationQueue}
                className="text-[11px] font-semibold text-primary hover:underline mt-0.5 flex items-center gap-1"
              >
                Open Verification Queue →
              </button>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                All submitted tasks signed off
              </p>
            )}
          </div>
          <div className="size-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center">
            <Clock className="size-5" />
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search & View Toggles */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={filterMode === "ALL" ? "primary" : "outline"}
            onClick={() => setFilterMode("ALL")}
            className="text-xs h-8"
          >
            All Groups ({groups.length})
          </Button>

          <Button
            size="sm"
            variant={filterMode === "MY_GROUPS" ? "primary" : "outline"}
            onClick={() => setFilterMode("MY_GROUPS")}
            className="text-xs h-8 gap-1.5"
          >
            <GraduationCap className="size-3.5" />
            My Guided Groups
          </Button>

          <Button
            size="sm"
            variant={filterMode === "NEEDS_ATTENTION" ? "primary" : "outline"}
            onClick={() => setFilterMode("NEEDS_ATTENTION")}
            className="text-xs h-8 gap-1.5 text-amber-600 dark:text-amber-400"
          >
            <AlertTriangle className="size-3.5" />
            Needs Attention
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search code, title, guide..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-card"
            />
          </div>

          <div className="flex items-center border rounded-md p-0.5 bg-muted/40 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("GRID")}
              className={`p-1.5 rounded ${
                viewMode === "GRID"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("LIST")}
              className={`p-1.5 rounded ${
                viewMode === "LIST"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="List View"
            >
              <ListIcon className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Grid vs List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-5 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
              <div className="h-2 w-full bg-muted rounded mt-4" />
            </div>
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-xl space-y-2">
          <Filter className="size-8 mx-auto text-muted-foreground" />
          <p className="font-semibold text-sm text-foreground">
            No capstone groups match the selected filter
          </p>
          <p className="text-xs text-muted-foreground">
            Try switching filters or clearing your search query.
          </p>
        </div>
      ) : viewMode === "GRID" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => {
            const hasPendingTasks = group.pending_review_tasks > 0;
            const projectLink = group.project_id
              ? `/workspaces/${workspaceId}/projects/${group.project_id}`
              : `/workspaces/${workspaceId}/tasks`;

            return (
              <div
                key={group.team_id}
                className="p-5 rounded-xl border bg-card hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex flex-col justify-between shadow-xs hover:shadow-sm"
              >
                <div className="space-y-3">
                  {/* Header: Code & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="font-mono text-xs font-bold px-2 py-0.5">
                      {group.team_code}
                    </Badge>

                    {hasPendingTasks ? (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 text-[10px] gap-1 px-2">
                        <Clock className="size-3" />
                        {group.pending_review_tasks} to verify
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                        {group.completed_tasks}/{group.total_tasks} Done
                      </Badge>
                    )}
                  </div>

                  {/* Project Title */}
                  <div>
                    <h4 className="font-bold text-sm text-foreground line-clamp-2 leading-snug">
                      {group.project_title}
                    </h4>
                  </div>

                  {/* Lead and Guide metadata */}
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/80">Faculty Guide:</span>
                      <span className="font-medium text-foreground truncate max-w-[150px]">
                        {group.guide_name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/80">Team Lead:</span>
                      <span className="font-medium text-foreground truncate max-w-[150px]">
                        {group.lead_name}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                      <span>Completion</span>
                      <span className="text-foreground font-semibold">
                        {group.progress_percentage}%
                      </span>
                    </div>
                    <Progress value={Number(group.progress_percentage)} className="h-1.5" />
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-4 border-t mt-4 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {group.total_tasks} tasks registered
                  </span>

                  <Button asChild size="xs" variant="outline" className="gap-1 text-xs">
                    <Link href={projectLink}>
                      Inspect Group
                      <ExternalLink className="size-3 ml-0.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List / Table Matrix View */
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-4">Project Title</th>
                  <th className="py-3 px-4">Faculty Guide</th>
                  <th className="py-3 px-4">Team Lead</th>
                  <th className="py-3 px-4">Tasks Progress</th>
                  <th className="py-3 px-4 text-center">Review Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredGroups.map((group) => {
                  const projectLink = group.project_id
                    ? `/workspaces/${workspaceId}/projects/${group.project_id}`
                    : `/workspaces/${workspaceId}/tasks`;

                  return (
                    <tr key={group.team_id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {group.team_code}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground max-w-xs truncate">
                        {group.project_title}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-medium">
                        {group.guide_name}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {group.lead_name}
                      </td>
                      <td className="py-3 px-4 w-44">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Number(group.progress_percentage)}
                            className="h-1.5 flex-1"
                          />
                          <span className="text-[11px] font-semibold w-9 text-right text-foreground">
                            {group.progress_percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {group.pending_review_tasks > 0 ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 text-[10px] gap-1">
                            <Clock className="size-3" />
                            {group.pending_review_tasks} to verify
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                            Clear
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button asChild size="xs" variant="ghost" className="h-7 text-xs">
                          <Link href={projectLink}>
                            Inspect
                            <ExternalLink className="size-3 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
