import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  hint?: string;
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  hint,
}: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 my-4 min-h-[220px]">
      <div className="size-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3 text-neutral-500">
        <Icon className="size-6 stroke-[1.5]" />
      </div>
      <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
        {description}
      </p>

      {actionLabel && (onAction || actionHref) && (
        <div className="mt-4">
          {actionHref ? (
            <Button size="sm" asChild>
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}

      {hint && (
        <p className="text-[11px] text-neutral-400 mt-2 italic">
          {hint}
        </p>
      )}
    </div>
  );
};
