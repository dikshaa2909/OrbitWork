"use client";

import { Play, CheckCircle2, Calendar, Target, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DottedSeparator } from "@/components/dotted-separator";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { useGetSprints } from "../api/use-get-sprints";
import { useUpdateSprint } from "../api/use-update-sprint";
import { useDeleteSprint } from "../api/use-delete-sprint";
import { useCreateSprintModal } from "../hooks/use-create-sprint-modal";
import { usePermissions } from "@/hooks/use-permissions";
import { Sprint, SprintStatus } from "../types";

interface SprintListProps {
  projectId?: string | null;
}

export const SprintList = ({ projectId }: SprintListProps) => {
  const workspaceId = useWorkspaceId();
  const { open } = useCreateSprintModal();
  const { canManageSprints } = usePermissions(workspaceId);
  const { data: sprintsData, isLoading } = useGetSprints({
    workspaceId,
    projectId,
  });
  const { mutate: updateSprint, isPending: isUpdating } = useUpdateSprint();
  const { mutate: deleteSprint, isPending: isDeleting } = useDeleteSprint();

  const sprints = sprintsData?.documents || [];

  const handleStart = (sprint: Sprint) => {
    updateSprint({
      param: { sprintId: sprint.$id || sprint.id },
      json: {
        status: SprintStatus.ACTIVE,
        startDate: new Date(),
      },
    });
  };

  const handleComplete = (sprint: Sprint) => {
    updateSprint({
      param: { sprintId: sprint.$id || sprint.id },
      json: {
        status: SprintStatus.COMPLETED,
        endDate: new Date(),
      },
    });
  };

  const handleDelete = (sprintId: string) => {
    deleteSprint({ param: { sprintId } });
  };

  const getStatusBadge = (status: SprintStatus) => {
    switch (status) {
      case SprintStatus.ACTIVE:
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Active
          </Badge>
        );
      case SprintStatus.COMPLETED:
        return (
          <Badge variant="outline" className="text-muted-foreground border-muted-foreground">
            Completed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Planning
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Sprints</h2>
          <p className="text-xs text-muted-foreground">
            Plan, track, and ship work in agile sprint cycles
          </p>
        </div>
        {canManageSprints && (
          <Button onClick={open} size="sm" className="gap-x-1.5">
            <Plus className="size-4" />
            Create Sprint
          </Button>
        )}
      </div>

      <DottedSeparator />

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading sprints...
        </div>
      ) : sprints.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center bg-neutral-50/50 dark:bg-neutral-900/30">
          <Target className="mx-auto size-8 text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-foreground">No sprints yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {canManageSprints
              ? "Create your first sprint to organize tasks into time-boxed iterations."
              : "No active or planned sprints in this project yet."}
          </p>
          {canManageSprints ? (
            <Button onClick={open} size="sm" variant="outline" className="mt-4">
              Create First Sprint
            </Button>
          ) : (
            <p className="text-[11px] text-neutral-400 mt-3 italic">
              Ask a Project Manager or Admin to plan a sprint.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-y-3">
          {sprints.map((sprint) => {
            const sprintId = sprint.$id || sprint.id;
            return (
              <div
                key={sprintId}
                className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-lg border bg-card shadow-sm hover:border-neutral-300 dark:hover:border-neutral-700 transition"
              >
                <div className="flex flex-col gap-y-1">
                  <div className="flex items-center gap-x-2.5">
                    <span className="font-semibold text-foreground text-sm">
                      {sprint.name}
                    </span>
                    {getStatusBadge(sprint.status)}
                  </div>

                  {sprint.goal && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      <span className="font-medium">Goal:</span> {sprint.goal}
                    </p>
                  )}

                  {(sprint.startDate || sprint.endDate) && (
                    <div className="flex items-center gap-x-1.5 text-[11px] text-muted-foreground mt-0.5">
                      <Calendar className="size-3" />
                      <span>
                        {sprint.startDate
                          ? format(new Date(sprint.startDate), "MMM d, yyyy")
                          : "TBD"}{" "}
                        -{" "}
                        {sprint.endDate
                          ? format(new Date(sprint.endDate), "MMM d, yyyy")
                          : "TBD"}
                      </span>
                    </div>
                  )}
                </div>

                {canManageSprints && (
                  <div className="flex items-center gap-x-2 w-full md:w-auto justify-end">
                    {sprint.status === SprintStatus.PLANNING && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStart(sprint)}
                        disabled={isUpdating}
                        className="gap-x-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                      >
                        <Play className="size-3.5 fill-current" />
                        Start Sprint
                      </Button>
                    )}

                    {sprint.status === SprintStatus.ACTIVE && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleComplete(sprint)}
                        disabled={isUpdating}
                        className="gap-x-1 text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950"
                      >
                        <CheckCircle2 className="size-3.5" />
                        Complete Sprint
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(sprintId)}
                      disabled={isDeleting}
                      className="text-muted-foreground hover:text-rose-600"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
