"use client";

import React, { useState } from "react";
import { Key, Send, CheckCircle2 } from "lucide-react";
import { ResponsiveModal } from "@/components/responsive-modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSIONS_CATALOG } from "@/lib/permissions/catalog";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCreateAccessRequest } from "../api/use-create-access-request";

export interface RequestAccessDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  initialPermission?: string;
  resourceType?: string;
  resourceId?: string;
}

export const RequestAccessDialog: React.FC<RequestAccessDialogProps> = ({
  isOpen,
  setIsOpen,
  initialPermission = "tasks:create",
  resourceType,
  resourceId,
}) => {
  const workspaceId = useWorkspaceId();
  const [permissionKey, setPermissionKey] = useState(initialPermission);
  const [duration, setDuration] = useState<"ONE_TIME" | "TIME_LIMITED" | "PERMANENT">("PERMANENT");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { mutate: submitRequest, isPending } = useCreateAccessRequest();

  // Find info from catalog
  const selectedCat = PERMISSIONS_CATALOG.find((p) => p.key === permissionKey);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;

    submitRequest(
      {
        workspaceId,
        permissionKey,
        resourceType,
        resourceId,
        duration,
        reason: reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          setTimeout(() => {
            setSubmitted(false);
            setIsOpen(false);
            setReason("");
          }, 1800);
        },
      }
    );
  };

  return (
    <ResponsiveModal open={isOpen} onOpenChange={setIsOpen}>
      <div className="p-6 space-y-4">
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <div className="size-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="size-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              Request Submitted
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Workspace administrators have been notified. You will receive an alert once reviewed.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
                <Key className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  Request Access
                </h2>
                <p className="text-xs text-muted-foreground">
                  Ask workspace administrators to grant you specific permissions.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Permission Needed</Label>
                <Select value={permissionKey} onValueChange={setPermissionKey} disabled={isPending}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {PERMISSIONS_CATALOG.map((p) => (
                      <SelectItem key={p.key} value={p.key} className="text-xs">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-[11px] text-muted-foreground ml-2">({p.key})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCat && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {selectedCat.description}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Requested Duration</Label>
                <Select
                  value={duration}
                  onValueChange={(v) => setDuration(v as typeof duration)}
                  disabled={isPending}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONE_TIME">One-time action (1 use)</SelectItem>
                    <SelectItem value="TIME_LIMITED">Temporary (24 hours / 7 days)</SelectItem>
                    <SelectItem value="PERMANENT">Permanent permission</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Reason for Request <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  placeholder="Explain why you need this access (e.g. 'Need to update sprint backlog for Mobile project')"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isPending}
                  className="text-xs min-h-[80px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
                <Send className="size-3.5" />
                {isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </ResponsiveModal>
  );
};
