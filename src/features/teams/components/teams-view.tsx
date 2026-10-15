"use client";

import React, { useState } from "react";
import { Plus, Users, Network, Crown, Trash2, Search } from "lucide-react";
import { useGetTeams } from "../api/use-get-teams";
import { useDeleteTeam } from "../api/use-delete-team";
import { useGetHierarchy } from "../api/use-get-hierarchy";
import { Team } from "../types";
import { CreateTeamDialog } from "./create-team-dialog";
import { TeamMembersDialog } from "./team-members-dialog";
import { OrgChartTree } from "./org-chart-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface TeamsViewProps {
  workspaceId: string;
}

export const TeamsView: React.FC<TeamsViewProps> = ({ workspaceId }) => {
  const { data: teams = [], isLoading: isTeamsLoading } = useGetTeams({ workspaceId });
  const { data: hierarchyData, isLoading: isHierarchyLoading } = useGetHierarchy({ workspaceId });
  const { mutate: deleteTeam, isPending: isDeleting } = useDeleteTeam();

  const [activeTab, setActiveTab] = useState<"teams" | "chart">("teams");
  const [search, setSearch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTeamForMembers, setSelectedTeamForMembers] = useState<Team | null>(null);

  const filteredTeams = teams.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  });

  const handleDelete = (teamId: string, teamName: string) => {
    if (window.confirm(`Are you sure you want to delete team "${teamName}"?`)) {
      deleteTeam({ param: { teamId } });
    }
  };

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Users className="size-6 text-indigo-600" />
            Teams & Organization Hierarchy
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize departments, squads, leadership assignments, and direct reporting lines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "teams" | "chart")}
            className="w-auto"
          >
            <TabsList>
              <TabsTrigger value="teams" className="text-xs gap-1.5">
                <Users className="size-3.5" />
                Teams & Squads
              </TabsTrigger>
              <TabsTrigger value="chart" className="text-xs gap-1.5">
                <Network className="size-3.5" />
                Org Chart
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-4" />
            Create Team
          </Button>
        </div>
      </div>

      {activeTab === "teams" ? (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search teams by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredTeams.length} team{filteredTeams.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Teams Grid */}
          {isTeamsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Skeleton className="h-44 w-full rounded-lg" />
              <Skeleton className="h-44 w-full rounded-lg" />
              <Skeleton className="h-44 w-full rounded-lg" />
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3 border border-dashed rounded-lg bg-neutral-50/50 dark:bg-neutral-900/50">
              <Users className="size-10 text-neutral-400" />
              <p className="text-sm font-semibold">No teams found</p>
              <p className="text-xs text-muted-foreground max-w-sm text-center">
                Create teams to group workspace members into squads, departments, or project clusters.
              </p>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                size="sm"
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="size-4" />
                Create First Team
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeams.map((team) => {
                const teamId = (team.id || team.$id) as string;
                return (
                  <div
                    key={teamId}
                    className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xs flex flex-col justify-between hover:shadow-sm transition"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                            {team.name}
                          </h3>
                          {team.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {team.description}
                            </p>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(teamId, team.name)}
                          disabled={isDeleting}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      {/* Lead Member */}
                      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Team Lead
                        </span>
                        {team.leadMember ? (
                          <div className="flex items-center gap-2 mt-1.5">
                            <MemberAvatar
                              name={team.leadMember.name || team.leadMember.email}
                              className="size-6 text-[10px]"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-medium truncate block">
                                {team.leadMember.name || team.leadMember.email}
                              </span>
                            </div>
                            <Crown className="size-3 text-amber-500 flex-shrink-0" />
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic mt-1">
                            Unassigned
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-4 mt-4 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {team.memberCount || 0} Member{team.memberCount !== 1 ? "s" : ""}
                      </Badge>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedTeamForMembers(team)}
                        className="text-xs gap-1.5 h-8 font-medium"
                      >
                        <Users className="size-3.5" />
                        Manage Roster
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          {isHierarchyLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Loading hierarchy chart...
            </div>
          ) : (
            <OrgChartTree
              members={hierarchyData?.members || []}
              workspaceId={workspaceId}
            />
          )}
        </div>
      )}

      {/* Modals */}
      <CreateTeamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        workspaceId={workspaceId}
        existingTeams={teams}
      />

      <TeamMembersDialog
        open={Boolean(selectedTeamForMembers)}
        onOpenChange={(open) => !open && setSelectedTeamForMembers(null)}
        team={selectedTeamForMembers}
        workspaceId={workspaceId}
      />
    </div>
  );
};
