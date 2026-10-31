"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  GraduationCap,
  Users,
  Award,
  Plus,
  FileSpreadsheet,
  Clock,
  LayoutGrid,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useGetBatches } from "../api/use-get-batches";
import { useCreateBatch } from "../api/use-create-batch";
import { useGetAcademicTeams } from "../api/use-get-academic-teams";
import { TeamsTab } from "./teams-tab";
import { BatchOverviewTab } from "./batch-overview-tab";
import { GuideVerificationQueue } from "./guide-verification-queue";
import { HodMilestonesOverview } from "./hod-milestones-overview";
import { FacultyMilestoneEvaluation } from "./faculty-milestone-evaluation";
import { StudentMilestonePortal } from "./student-milestone-portal";
import { StatCard } from "./stat-card";
import { usePermissions } from "@/hooks/use-permissions";
import { useCollegePersona } from "../hooks/use-college-persona";
import { Batch } from "../types";

interface BatchesViewProps {
  workspaceId: string;
}

export const BatchesView: React.FC<BatchesViewProps> = ({ workspaceId }) => {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  const { data: batches = [], isLoading: isBatchesLoading } = useGetBatches({
    workspaceId,
  });

  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [createBatchOpen, setCreateBatchOpen] = useState(false);

  // Form state
  const [batchName, setBatchName] = useState("");
  const [department, setDepartment] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-2027");

  const { can } = usePermissions(workspaceId);
  const { isHod, isGuide, isStudent, isTeamLead, teamId, isLoading: isPersonaLoading } = useCollegePersona(workspaceId);
  const canManage = can("college:batches.manage") || can("workspace:settings.edit");
  const canAssignGuide = can("college:guides.assign") || canManage;
  const canExport = can("college:reports.export") || canManage;

  const tabParam = searchParams.get("tab");
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const { mutate: createBatch, isPending: isCreatingBatch } = useCreateBatch();

  // Auto-select first batch
  useEffect(() => {
    if (!selectedBatch && batches.length > 0) {
      setSelectedBatch(batches[0]);
    }
  }, [batches, selectedBatch]);

  const { data: teams = [], isLoading: isTeamsLoading } = useGetAcademicTeams({
    batchId: selectedBatch?.id,
  });

  const handleCreateBatch = () => {
    if (!batchName.trim() || !department.trim()) return;

    createBatch(
      {
        param: { workspaceId },
        json: {
          workspaceId,
          name: batchName.trim(),
          department: department.trim(),
          academicYear: academicYear.trim(),
        },
      },
      {
        onSuccess: () => {
          setCreateBatchOpen(false);
          setBatchName("");
          setDepartment("");
        },
      }
    );
  };

  const handleExportCSV = async () => {
    if (!selectedBatch) return;

    try {
      const res = await fetch(`/api/college/batches/${selectedBatch.id}/export-sheet`);
      const json = await res.json();
      if (!json?.data) throw new Error("No data returned");

      const { batchName, department, academicYear, milestoneHeaders, rows } = json.data;

      // Construct CSV
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

  if (isBatchesLoading || isPersonaLoading) {
    return (
      <div className="flex items-center justify-center min-h-[360px]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Student Experience: Sequential milestone roadmap & deliverables submission portal
  if ((isStudent || isTeamLead) && teamId) {
    return (
      <div className="space-y-6">
        <StudentMilestonePortal workspaceId={workspaceId} teamId={teamId} />
      </div>
    );
  }

  // Faculty Guide Experience: Dedicated verification queue & milestone evaluation operations
  if (isGuide && !isHod) {
    const guideTab = activeTab === "milestones" ? "milestones" : "verify";

    return (
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between pb-1 -mb-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground -ml-2"
          >
            <Link href={`/workspaces/${workspaceId}`}>
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Link>
          </Button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Link href={`/workspaces/${workspaceId}`} className="hover:underline">
              Workspace
            </Link>
            <span>&gt;</span>
            <span className="text-foreground font-semibold">Faculty Operations</span>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Clock className="size-6 text-amber-500" />
              Faculty Guide Operations
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review completed student tasks, verify code and report proofs, and evaluate milestone defense presentations for your guided groups.
            </p>
          </div>
        </div>

        {/* Guide Operations Tabs */}
        <Tabs value={guideTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="verify" className="gap-2 text-xs font-semibold">
              <Clock className="size-3.5" />
              Verification Queue
            </TabsTrigger>
            <TabsTrigger value="milestones" className="gap-2 text-xs font-semibold">
              <Award className="size-3.5" />
              Milestone Evaluations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="verify" className="pt-4">
            <GuideVerificationQueue workspaceId={workspaceId} />
          </TabsContent>

          <TabsContent value="milestones" className="pt-4">
            <FacultyMilestoneEvaluation workspaceId={workspaceId} batches={batches} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Persistent Breadcrumb & Back Navigation */}
      <div className="flex items-center justify-between pb-1 -mb-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground -ml-2"
        >
          <Link href={`/workspaces/${workspaceId}`}>
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <Link href={`/workspaces/${workspaceId}`} className="hover:underline">
            Workspace
          </Link>
          <span>&gt;</span>
          <span className="text-foreground font-semibold">Academic Batches</span>
          {selectedBatch && (
            <>
              <span>&gt;</span>
              <span className="text-primary font-semibold">{selectedBatch.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Top Banner & Batch Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="size-6 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Academic Project Management
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Department batches, capstone group rosters, and evaluation oversight.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {batches.length > 0 && (
            <select
              value={selectedBatch?.id || ""}
              onChange={(e) => {
                const found = batches.find((b) => b.id === e.target.value);
                if (found) setSelectedBatch(found);
              }}
              className="h-9 px-3 rounded-md border border-input bg-card text-xs font-semibold"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.department})
                </option>
              ))}
            </select>
          )}

          {canExport && selectedBatch && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCSV}
              className="text-xs h-9 gap-1.5"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              Export Marksheet
            </Button>
          )}

          {canManage && (
            <Button
              size="sm"
              onClick={() => setCreateBatchOpen(true)}
              className="text-xs h-9 gap-1.5"
            >
              <Plus className="size-3.5" />
              New Batch
            </Button>
          )}
        </div>
      </div>

      {isBatchesLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-xl border bg-muted/40 p-4 space-y-2">
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-6 w-24 bg-muted rounded" />
              </div>
            ))}
          </div>
          <div className="h-64 rounded-xl border bg-muted/20" />
        </div>
      ) : !selectedBatch ? (
        <div className="py-16 border border-dashed rounded-xl text-center space-y-3">
          <GraduationCap className="size-10 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-bold text-foreground">
            No academic batches configured
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Create an academic batch (e.g. &quot;BE Final Year 2026-27 Computer Engineering&quot;) to organize capstone projects, rubrics, and milestone defense cycles.
          </p>
          {canManage && (
            <Button
              size="sm"
              onClick={() => setCreateBatchOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              Create First Batch
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Department"
              value={selectedBatch.department}
              icon={GraduationCap}
              iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            />
            <StatCard
              label="Academic Year"
              value={selectedBatch.academic_year}
              icon={Clock}
              iconClassName="bg-purple-500/10 text-purple-600 dark:text-purple-400"
            />
            <StatCard
              label="Project Teams"
              value={teams.length}
              icon={Users}
              iconClassName="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            />
            <StatCard
              label="Active Milestones"
              value={selectedBatch.milestones_count || 0}
              icon={Award}
              iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            />
          </div>

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="overview" className="text-xs gap-1.5">
                <LayoutGrid className="size-3.5" />
                Department Overview
              </TabsTrigger>
              <TabsTrigger value="teams" className="text-xs gap-1.5">
                <Users className="size-3.5" />
                Project Teams ({teams.length})
              </TabsTrigger>
              <TabsTrigger value="milestones" className="text-xs gap-1.5">
                <Award className="size-3.5" />
                Milestones & Oversight
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-4">
              <BatchOverviewTab
                batch={selectedBatch}
                workspaceId={workspaceId}
                isHod={canManage}
                onOpenVerificationQueue={() => setActiveTab("milestones")}
              />
            </TabsContent>

            <TabsContent value="teams" className="pt-4">
              <TeamsTab
                batch={selectedBatch}
                batches={batches}
                teams={teams}
                isLoading={isTeamsLoading}
                workspaceId={workspaceId}
                canManage={canManage}
                canAssignGuide={canAssignGuide}
              />
            </TabsContent>

            <TabsContent value="milestones" className="pt-4">
              <HodMilestonesOverview
                batch={selectedBatch}
                workspaceId={workspaceId}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Create Batch Dialog */}
      <Dialog open={createBatchOpen} onOpenChange={setCreateBatchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Academic Batch</DialogTitle>
            <DialogDescription>
              Set up a cohort for capstone projects, final year reviews, or research labs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="b-name">Batch Name *</Label>
              <Input
                id="b-name"
                placeholder="e.g. BE Final Year Major Projects 2026-27"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="b-dept">Department *</Label>
                <Input
                  id="b-dept"
                  placeholder="Computer Engineering"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-year">Academic Year *</Label>
                <Input
                  id="b-year"
                  placeholder="2026-2027"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateBatchOpen(false)}
              disabled={isCreatingBatch}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateBatch}
              disabled={!batchName.trim() || !department.trim() || isCreatingBatch}
            >
              {isCreatingBatch ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Batch"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
