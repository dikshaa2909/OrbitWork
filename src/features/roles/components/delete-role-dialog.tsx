"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Role } from "../types";
import { useDeleteRole } from "../api/use-delete-role";
import { AlertCircle } from "lucide-react";

interface DeleteRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  allRoles: Role[];
}

export const DeleteRoleDialog: React.FC<DeleteRoleDialogProps> = ({
  open,
  onOpenChange,
  role,
  allRoles,
}) => {
  const [reassignToRoleId, setReassignToRoleId] = useState<string>("");
  const { mutate: deleteRole, isPending } = useDeleteRole();

  const hasMembers = (role?.memberCount || 0) > 0;
  const eligibleTargetRoles = allRoles.filter(
    (r) => (r.id || r.$id) !== (role?.id || role?.$id)
  );

  const handleDelete = () => {
    if (!role) return;
    if (hasMembers && !reassignToRoleId) return;

    deleteRole(
      {
        param: { roleId: role.id || (role.$id as string) },
        query: reassignToRoleId ? { reassignToRoleId } : {},
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setReassignToRoleId("");
        },
      }
    );
  };

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-x-2">
            <AlertCircle className="size-5" />
            Delete Role &quot;{role.name}&quot;
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this custom role? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {hasMembers && (
          <div className="space-y-3 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md p-3 text-amber-900 dark:text-amber-200">
            <p className="text-sm font-semibold">
              This role is currently assigned to {role.memberCount} member{role.memberCount! > 1 ? "s" : ""}.
            </p>
            <p className="text-xs text-muted-foreground">
              Please choose a role to reassign these members to before deleting.
            </p>
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-medium">Reassign members to</Label>
              <Select value={reassignToRoleId} onValueChange={setReassignToRoleId}>
                <SelectTrigger className="bg-white dark:bg-neutral-900">
                  <SelectValue placeholder="Select replacement role" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleTargetRoles.map((r) => (
                    <SelectItem key={r.id || r.$id} value={(r.id || r.$id) as string}>
                      {r.name} (Level {r.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending || (hasMembers && !reassignToRoleId)}
          >
            {isPending ? "Deleting..." : "Delete Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
