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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Role } from "../types";
import { useCloneRole } from "../api/use-clone-role";

interface CloneRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
}

export const CloneRoleDialog: React.FC<CloneRoleDialogProps> = ({
  open,
  onOpenChange,
  role,
}) => {
  const [name, setName] = useState("");
  const { mutate: cloneRole, isPending } = useCloneRole();

  React.useEffect(() => {
    if (role) {
      setName(`Copy of ${role.name}`);
    }
  }, [role]);

  const handleClone = () => {
    if (!role || !name.trim()) return;

    cloneRole(
      {
        param: { roleId: role.id || (role.$id as string) },
        json: { name: name.trim() },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setName("");
        },
      }
    );
  };

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clone Role</DialogTitle>
          <DialogDescription>
            Create a new custom role with an exact copy of permissions from{" "}
            <strong>{role.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="clone-role-name">New Role Name</Label>
            <Input
              id="clone-role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Senior Developer"
            />
          </div>
        </div>

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
            onClick={handleClone}
            disabled={!name.trim() || isPending}
          >
            {isPending ? "Cloning..." : "Clone Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
