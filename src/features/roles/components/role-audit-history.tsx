"use client";

import React, { useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Clock, ShieldAlert, User, Search, RefreshCw, KeyRound, UserCheck, Layers, Users } from "lucide-react";
import { useGetAuditLogs } from "../api/use-get-audit-logs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RoleAuditHistoryProps {
  workspaceId: string;
}

export const RoleAuditHistory: React.FC<RoleAuditHistoryProps> = ({ workspaceId }) => {
  const [search, setSearch] = useState("");
  const { data: logs = [], isLoading, refetch, isFetching } = useGetAuditLogs({ workspaceId });

  const filteredLogs = logs.filter((log) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      log.actorName?.toLowerCase().includes(q) ||
      log.actorEmail?.toLowerCase().includes(q) ||
      log.entityType.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q)
    );
  });

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "ROLE":
        return <Layers className="size-4 text-indigo-500" />;
      case "PERMISSION":
        return <KeyRound className="size-4 text-emerald-500" />;
      case "MEMBER_ROLE":
        return <UserCheck className="size-4 text-blue-500" />;
      case "TEAM":
        return <Users className="size-4 text-purple-500" />;
      default:
        return <Clock className="size-4 text-neutral-500" />;
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "CREATE":
        return "default";
      case "UPDATE":
        return "secondary";
      case "DELETE":
        return "destructive";
      case "ASSIGN":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Clock className="size-5 text-indigo-600" />
            Security & Permission Audit Trail
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable chronological record of role creations, permission modifications, and member assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Filter audit entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 gap-1 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
            <RefreshCw className="size-6 animate-spin text-primary" />
            <span className="text-sm">Loading audit records...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2 border border-dashed rounded-lg">
            <ShieldAlert className="size-8 text-neutral-400" />
            <p className="text-sm font-medium">No permission audit records found</p>
            <p className="text-xs text-muted-foreground max-w-sm text-center">
              Changes to roles, permissions, or hierarchy assignments will be captured here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {filteredLogs.map((log) => {
              let relativeTime = "";
              try {
                relativeTime = formatDistanceToNow(parseISO(log.created_at), {
                  addSuffix: true,
                });
              } catch {
                relativeTime = log.created_at;
              }

              return (
                <div
                  key={log.id}
                  className="py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-md mt-0.5 flex-shrink-0">
                      {getEntityIcon(log.entityType)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1">
                          <User className="size-3.5 text-muted-foreground inline" />
                          {log.actorName || "Workspace Member"}
                        </span>
                        <Badge variant={getActionBadgeVariant(log.action)} className="text-[11px] uppercase tracking-wider font-mono">
                          {log.action}
                        </Badge>
                        <span className="text-muted-foreground">on</span>
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {log.entityType}
                        </Badge>
                        <code className="text-[11px] bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-600 dark:text-neutral-400 font-mono">
                          {log.entityId}
                        </code>
                      </div>

                      {/* Values diff */}
                      {(log.newValues || log.oldValues) && (
                        <div className="text-[11px] font-mono bg-neutral-50 dark:bg-neutral-950 p-2 rounded border border-neutral-100 dark:border-neutral-800/60 max-w-2xl text-muted-foreground mt-1 overflow-x-auto">
                          {log.newValues && (
                            <div>
                              <strong className="text-emerald-600 dark:text-emerald-400">Values: </strong>
                              {typeof log.newValues === "string" ? log.newValues : JSON.stringify(log.newValues)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground flex-shrink-0 self-start sm:self-center font-mono pl-11 sm:pl-0">
                    {relativeTime}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
