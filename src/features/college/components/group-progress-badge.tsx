"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GroupProgressBadgeProps {
  percentage: number;
  completedTasks?: number;
  totalTasks?: number;
  className?: string;
  showBar?: boolean;
}

export const GroupProgressBadge: React.FC<GroupProgressBadgeProps> = ({
  percentage,
  completedTasks,
  totalTasks,
  className,
  showBar = true,
}) => {
  const boundedPct = Math.min(100, Math.max(0, percentage));

  const getStatusColor = (pct: number) => {
    if (pct >= 80) return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (pct >= 40) return "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20";
    if (pct > 0) return "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-muted-foreground bg-muted/40 border-border/40";
  };

  const getBarColor = (pct: number) => {
    if (pct >= 80) return "bg-emerald-500";
    if (pct >= 40) return "bg-blue-500";
    if (pct > 0) return "bg-amber-500";
    return "bg-muted-foreground/30";
  };

  return (
    <div className={cn("space-y-1.5 min-w-[90px]", className)}>
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded border tracking-tight",
            getStatusColor(boundedPct)
          )}
        >
          {boundedPct}%
        </span>
        {totalTasks !== undefined && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {completedTasks ?? 0}/{totalTasks}
          </span>
        )}
      </div>

      {showBar && (
        <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300 rounded-full", getBarColor(boundedPct))}
            style={{ width: `${boundedPct}%` }}
          />
        </div>
      )}
    </div>
  );
};

