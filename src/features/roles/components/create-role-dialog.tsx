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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SYSTEM_ROLE_TEMPLATES, HIERARCHY_LEVELS } from "@/lib/permissions/catalog";
import { useCreateRole } from "../api/use-create-role";

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

const COLOR_PRESETS = [
  "#6366f1", // Indigo
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#64748b", // Slate
];

// Convert Record to array for iteration
const TEMPLATE_ENTRIES = Object.entries(SYSTEM_ROLE_TEMPLATES);

export const CreateRoleDialog: React.FC<CreateRoleDialogProps> = ({
  open,
  onOpenChange,
  workspaceId,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<number>(HIERARCHY_LEVELS.MEMBER);
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("CUSTOM");

  const { mutate: createRole, isPending } = useCreateRole();

  const handleTemplateChange = (templateKey: string) => {
    setSelectedTemplateKey(templateKey);
    if (templateKey !== "CUSTOM") {
      const t = SYSTEM_ROLE_TEMPLATES[templateKey];
      if (t) {
        setName(t.name);
        setDescription(t.description);
        setLevel(t.level);
        setColor(t.color);
      }
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;

    let initialPermissions: string[] = [];
    if (selectedTemplateKey !== "CUSTOM") {
      const t = SYSTEM_ROLE_TEMPLATES[selectedTemplateKey];
      if (t) {
        initialPermissions = t.permissions;
      }
    }

    createRole(
      {
        json: {
          workspaceId,
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          level,
          permissions: initialPermissions,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setName("");
          setDescription("");
          setSelectedTemplateKey("CUSTOM");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Custom Role</DialogTitle>
          <DialogDescription>
            Add a new role to your workspace hierarchy with custom permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Start from template (optional)</Label>
            <Select value={selectedTemplateKey} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUSTOM">Blank (start from scratch)</SelectItem>
                {TEMPLATE_ENTRIES.map(([key, tmpl]) => (
                  <SelectItem key={key} value={key}>
                    {tmpl.name} (L{tmpl.level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role-name">Role Name *</Label>
            <Input
              id="role-name"
              placeholder="e.g. Lead Engineer, Senior QA, Product Designer"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role-desc">Description</Label>
            <Textarea
              id="role-desc"
              rows={2}
              placeholder="What this role is responsible for..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Hierarchy Level</Label>
              <Select
                value={level.toString()}
                onValueChange={(val) => setLevel(parseInt(val, 10))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">Level 15 (Senior Lead)</SelectItem>
                  <SelectItem value="20">Level 20 (Project Manager)</SelectItem>
                  <SelectItem value="25">Level 25 (Team Lead)</SelectItem>
                  <SelectItem value="30">Level 30 (Core Member)</SelectItem>
                  <SelectItem value="35">Level 35 (Junior Member)</SelectItem>
                  <SelectItem value="40">Level 40 (Viewer)</SelectItem>
                  <SelectItem value="45">Level 45 (External Guest)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Lower level = higher authority. Prevents privilege escalation.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Badge Color</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="size-6 rounded-full border border-black/10 transition-transform hover:scale-110 flex items-center justify-center"
                    style={{ backgroundColor: c }}
                  >
                    {color === c && (
                      <span className="size-2 rounded-full bg-white shadow-sm" />
                    )}
                  </button>
                ))}
              </div>
            </div>
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
            onClick={handleSave}
            disabled={!name.trim() || isPending}
          >
            {isPending ? "Creating..." : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

