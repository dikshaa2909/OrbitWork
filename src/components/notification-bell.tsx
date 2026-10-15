"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink, ShieldCheck, UserPlus, Key } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetNotifications } from "@/features/notifications/api/use-get-notifications";
import { useMarkNotificationRead } from "@/features/notifications/api/use-mark-notification-read";
import { useMarkAllRead } from "@/features/notifications/api/use-mark-all-read";
import type { Notification } from "@/features/access-requests/types";

export const NotificationBell: React.FC = () => {
  const workspaceId = useWorkspaceId();
  const [open, setOpen] = useState(false);

  const { data: notificationsData, isLoading } = useGetNotifications({
    workspaceId: workspaceId || "",
  });

  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllRead();

  const notifications = (notificationsData?.documents || []) as Notification[];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleItemClick = (n: Notification) => {
    if (!n.read && n.id) {
      markRead({ notificationId: n.id });
    }
  };

  const getIcon = (type: string) => {
    if (type.includes("approved")) return <ShieldCheck className="size-4 text-emerald-500" />;
    if (type.includes("denied")) return <Key className="size-4 text-rose-500" />;
    if (type.includes("invite")) return <UserPlus className="size-4 text-blue-500" />;
    return <Key className="size-4 text-amber-500" />;
  };

  if (!workspaceId) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Open notifications"
          className="relative inline-flex size-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-4 h-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-neutral-950">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
              Notifications
            </h4>
            {unreadCount > 0 && (
              <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {unreadCount} unread
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead({ workspaceId })}
              disabled={isMarkingAll}
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2"
            >
              <Check className="size-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-80 divide-y">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`p-3 text-xs transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50 cursor-pointer ${
                  !n.read ? "bg-amber-50/40 dark:bg-amber-950/20" : ""
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${!n.read ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1.5 pt-1 text-[10px] text-muted-foreground">
                      <span>{new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {n.actionUrl && (
                        <Link
                          href={n.actionUrl}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-0.5 text-blue-600 hover:underline"
                        >
                          View <ExternalLink className="size-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
