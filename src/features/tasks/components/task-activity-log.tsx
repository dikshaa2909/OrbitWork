"use client";

import { History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { MemberAvatar } from "@/features/members/components/member-avatar";
import { DottedSeparator } from "@/components/dotted-separator";

import { useGetActivity } from "../api/use-get-activity";

interface TaskActivityLogProps {
  taskId: string;
}

export const TaskActivityLog = ({ taskId }: TaskActivityLogProps) => {
  const { data, isLoading } = useGetActivity({ taskId });

  const activities = data?.documents || [];

  return (
    <div className="p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-x-2">
        <History className="size-5 text-muted-foreground" />
        <p className="text-lg font-semibold">Activity History</p>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">
          {activities.length}
        </span>
      </div>
      <DottedSeparator className="my-4" />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading history...</p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No recorded activity for this task yet.
        </p>
      ) : (
        <div className="flex flex-col gap-y-3">
          {activities.map((act) => (
            <div
              key={act.$id || act.id}
              className="flex items-start gap-x-3 text-sm py-1.5 border-b last:border-b-0 border-border/40"
            >
              <MemberAvatar
                name={act.member?.name || "User"}
                className="size-6 mt-0.5"
              />
              <div className="flex-1">
                <p className="text-foreground text-xs leading-relaxed">
                  <span className="font-semibold text-foreground">
                    {act.member?.name || "User"}
                  </span>{" "}
                  {act.action === "CREATED" && "created this task"}
                  {act.action === "STATUS_CHANGED" && (
                    <>
                      changed status from{" "}
                      <span className="font-medium text-amber-500">
                        {act.oldValue}
                      </span>{" "}
                      to{" "}
                      <span className="font-medium text-emerald-500">
                        {act.newValue}
                      </span>
                    </>
                  )}
                  {act.action === "COMMENT_ADDED" && "added a comment"}
                  {!["CREATED", "STATUS_CHANGED", "COMMENT_ADDED"].includes(
                    act.action
                  ) && act.action}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {act.$createdAt || act.created_at
                    ? formatDistanceToNow(
                        new Date(act.$createdAt || act.created_at),
                        { addSuffix: true }
                      )
                    : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
