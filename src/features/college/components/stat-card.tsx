"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  className?: string;
  iconClassName?: string;
  badge?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  icon: Icon,
  className,
  iconClassName,
  badge,
}) => {
  return (
    <div
      className={cn(
        "p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between transition hover:border-primary/30",
        className
      )}
    >
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {badge}
        </div>
        {subValue && (
          <p className="text-[11px] text-muted-foreground font-medium">{subValue}</p>
        )}
      </div>
      <div
        className={cn(
          "size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0",
          iconClassName
        )}
      >
        <Icon className="size-5" />
      </div>
    </div>
  );
};

