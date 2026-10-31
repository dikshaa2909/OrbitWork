"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import {
  Award,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Plus,
  ExternalLink,
  Users,
  GraduationCap,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { useGetHodMilestoneOverview } from "../api/use-get-hod-milestone-overview";
import { useCreateMilestone } from "../api/use-create-milestone";
import {
  Batch,
  HodGroupMilestoneCell,
  HodGroupMilestoneRow,
} from "../types";

interface HodMilestonesOverviewProps {
  batch: Batch;
  workspaceId?: string;
}

export const HodMilestonesOverview: React.FC<HodMilestonesOverviewProps> = ({
  batch,
}) => {
  const { data, isLoading, refetch } = useGetHodMilestoneOverview({
    batchId: batch.id,
  });

  const [createMilestoneOpen, setCreateMilestoneOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    group: HodGroupMilestoneRow;
    cell: HodGroupMilestoneCell;
  } | null>(null);

  // Milestone creation form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newMaxMarks, setNewMaxMarks] = useState("100");

  const { mutate: createMilestone, isPending: isCreating } = useCreateMilestone();

  const handleCreateMilestone = () => {
    if (!newTitle.trim()) return;

    createMilestone(
      {
        param: { batchId: batch.id },
        json: {
          batchId: batch.id,
          title: newTitle.trim(),
          description: newDesc.trim() || undefined,
          dueDate: newDueDate ? new Date(newDueDate) : undefined,
          maxMarks: parseFloat(newMaxMarks) || 100,
          criteria: [
            {
              title: "Problem Understanding & Architecture",
              maxScore: 25,
            },
            {
              title: "Technical Depth & Implementation",
              maxScore: 35,
            },
            {
              title: "Demonstration & Viva Defense",
              maxScore: 25,
            },
            {
              title: "Report & Documentation Quality",
              maxScore: 15,
            },
          ],
        },
      },
      {
        onSuccess: () => {
          setCreateMilestoneOpen(false);
          setNewTitle("");
          setNewDesc("");
          setNewDueDate("");
          setNewMaxMarks("100");
          refetch();
        },
      }
    );
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch(`/api/college/batches/${batch.id}/export-sheet`);
      const json = await res.json();
      if (!json?.data) throw new Error("No data returned");

      const { batchName, department, academicYear, milestoneHeaders, rows } = json.data;

      const headers = ["Team Code", "Project Title", "Members", "Guides", ...milestoneHeaders, "Total Marks"];
      const csvRows = [headers.join(",")];

      for (const r of rows) {
        const milestoneVals = milestoneHeaders.map((h: string) => r.milestones[h] || 0);
        const row = [
          `"${r.teamCode}"`,
          `"${r.title.replace(/"/g, '""')}"`,
          r.memberCount,
          r.guideCount,
          ...milestoneVals,
          r.totalMarks,
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute("download", `${batchName}_${department}_${academicYear}_Marksheet.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Consolidated grade sheet downloaded");
    } catch {
      toast.error("Failed to generate export sheet");
    }
  };

  const stats = data?.stats;
  const milestones = data?.milestones || [];
  const groups = data?.groups || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header & Actions Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border bg-card/60">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Award className="size-5 text-indigo-500" />
              Department Academic Milestones
            </h3>
            <Badge variant="outline" className="text-[10px] font-semibold">
              HOD OVERSIGHT MATRIX
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Cohort progress and milestone evaluation matrix.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="text-xs h-9 gap-1.5 font-medium border-border/80"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" />
            Export Marksheet (CSV)
          </Button>

          <Button
            size="sm"
            onClick={() => setCreateMilestoneOpen(true)}
            className="text-xs h-9 gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            <Plus className="size-3.5" />
            Configure Milestone
          </Button>
        </div>
      </div>

      {/* 2. Executive Department Health Metrics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Batch Progress
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {stats.completion_rate_percentage}%
              </span>
              <span className="text-xs text-muted-foreground">overall cleared</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Project Groups
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">
                {stats.total_groups}
              </span>
              <span className="text-xs text-muted-foreground">across cohort</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Pending Guide Reviews
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {stats.pending_faculty_review_count}
              </span>
              <span className="text-xs text-muted-foreground">submissions</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Overdue Submissions
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-destructive">
                {stats.overdue_submissions_count}
              </span>
              <span className="text-xs text-muted-foreground">need attention</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. The Executive Milestone Matrix Table */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-12 rounded-xl bg-muted" />
          <div className="h-48 rounded-xl bg-muted/60" />
        </div>
      ) : milestones.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-2xl space-y-3 bg-muted/10">
          <Award className="size-10 mx-auto text-muted-foreground stroke-1" />
          <h4 className="font-bold text-base text-foreground">
            No milestones configured for this batch yet
          </h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Establish the evaluation defense cycles (e.g. Synopsis, Progress Review 1, Architecture Viva, Final Viva) to activate grading.
          </p>
          <Button
            size="sm"
            onClick={() => setCreateMilestoneOpen(true)}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          >
            <Plus className="size-3.5" />
            Create First Milestone
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-2xl space-y-2 bg-muted/10">
          <Users className="size-9 mx-auto text-muted-foreground stroke-1" />
          <h4 className="font-bold text-sm text-foreground">
            No student project groups enrolled in {batch.name}
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Groups will appear in the matrix automatically once registered by faculty guides or cohort coordinators.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="py-3.5 px-4 min-w-[200px]">Project Group</th>
                  <th className="py-3.5 px-3 min-w-[130px]">Faculty Guide</th>
                  <th className="py-3.5 px-3 min-w-[130px]">Team Lead</th>
                  {milestones.map((m) => (
                    <th key={m.id} className="py-3.5 px-3 text-center min-w-[150px]">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-foreground truncate max-w-[140px]" title={m.title}>
                          {m.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {m.due_date ? format(new Date(m.due_date), "MMM d, yyyy") : "No due date"} • {m.max_marks} marks
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {groups.map((grp) => (
                  <tr key={grp.team_id} className="hover:bg-muted/20 transition-colors">
                    {/* Group info */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {grp.team_code}
                          </span>
                          <span className="font-semibold text-foreground text-xs line-clamp-1" title={grp.project_title}>
                            {grp.project_title}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {grp.member_count} member{grp.member_count === 1 ? "" : "s"}
                        </span>
                      </div>
                    </td>

                    {/* Assigned Guide */}
                    <td className="py-3 px-3 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="size-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate max-w-[120px]" title={grp.guide_name}>
                          {grp.guide_name}
                        </span>
                      </div>
                    </td>

                    {/* Team Lead */}
                    <td className="py-3 px-3 text-muted-foreground">
                      <span className="truncate max-w-[120px] block" title={grp.lead_name}>
                        {grp.lead_name}
                      </span>
                    </td>

                    {/* Milestone Cells */}
                    {grp.milestones.map((cell) => {
                      const isApproved = cell.status === "APPROVED";
                      const isSubmitted = cell.status === "SUBMITTED";
                      const isChanges = cell.status === "CHANGES_REQUESTED";
                      const isOverdue = cell.status === "OVERDUE";

                      return (
                        <td
                          key={cell.milestone_id}
                          className="py-3 px-3 text-center cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => setSelectedCell({ group: grp, cell })}
                        >
                          {isApproved ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 text-[10px] gap-1 font-bold">
                              <CheckCircle2 className="size-3" />
                              {cell.score !== null ? `${cell.score}/${cell.max_marks}` : "Approved"}
                            </Badge>
                          ) : isSubmitted ? (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 text-[10px] gap-1 font-medium">
                              <Clock className="size-3" />
                              Review Pending
                            </Badge>
                          ) : isChanges ? (
                            <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/50 text-[10px] gap-1 font-medium">
                              <AlertCircle className="size-3" />
                              Revisions
                            </Badge>
                          ) : isOverdue ? (
                            <Badge variant="destructive" className="text-[10px] gap-1 font-medium">
                              <AlertTriangle className="size-3" />
                              Overdue
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/60 italic">
                              Upcoming
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Read-Only Cell Inspection Dialog */}
      <Dialog open={Boolean(selectedCell)} onOpenChange={(open) => !open && setSelectedCell(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                {selectedCell?.group.team_code}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {selectedCell?.cell.status}
              </Badge>
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              {selectedCell?.cell.milestone_title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Project: <strong className="text-foreground">{selectedCell?.group.project_title}</strong> • Guide: {selectedCell?.group.guide_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {selectedCell?.cell.score !== null && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <span className="font-bold text-emerald-800 dark:text-emerald-300">
                  Evaluated Marks:
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {selectedCell?.cell.score} / {selectedCell?.cell.max_marks}
                </span>
              </div>
            )}

            {selectedCell?.cell.file_url ? (
              <div className="p-3 rounded-xl border bg-muted/30 space-y-1.5">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <ExternalLink className="size-3 text-primary" />
                  Submitted Deliverable:
                </span>
                <a
                  href={selectedCell.cell.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-mono break-all text-[11px] block"
                >
                  {selectedCell.cell.file_url}
                </a>
                {selectedCell.cell.submitted_at && (
                  <p className="text-[10px] text-muted-foreground pt-1">
                    Submitted on {format(new Date(selectedCell.cell.submitted_at), "MMM d, yyyy 'at' h:mm a")} (v{selectedCell.cell.version || 1})
                  </p>
                )}
              </div>
            ) : (
              <div className="py-4 text-center border border-dashed rounded-xl text-muted-foreground text-xs">
                No deliverable document submitted yet.
              </div>
            )}

            {selectedCell?.cell.remarks && (
              <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                <span className="font-semibold text-foreground">
                  Faculty Remarks / Notes:
                </span>
                <p className="text-muted-foreground italic leading-relaxed">
                  &quot;{selectedCell.cell.remarks}&quot;
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedCell(null)}
            >
              Close Overview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Create Milestone Dialog */}
      <Dialog open={createMilestoneOpen} onOpenChange={setCreateMilestoneOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="size-5 text-indigo-500" />
              Configure Batch Milestone
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a structured review defense cycle for all groups in {batch.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="mtitle" className="text-xs font-semibold">
                Milestone Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mtitle"
                placeholder="e.g. Synopsis Presentation & Literature Review"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mduedate" className="text-xs font-semibold">
                  Defense Due Date
                </Label>
                <Input
                  id="mduedate"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mmarks" className="text-xs font-semibold">
                  Max Marks
                </Label>
                <Input
                  id="mmarks"
                  type="number"
                  min="1"
                  max="500"
                  value={newMaxMarks}
                  onChange={(e) => setNewMaxMarks(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mdesc" className="text-xs font-semibold">
                Submission Guidelines & Objectives
              </Label>
              <Textarea
                id="mdesc"
                placeholder="e.g. Upload PDF presentation deck covering problem definition, methodology, and proposed system architecture."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="text-xs"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateMilestoneOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateMilestone}
              disabled={!newTitle.trim() || isCreating}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {isCreating && <Loader2 className="size-3.5 animate-spin" />}
              Publish Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
