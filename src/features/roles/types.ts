import { z } from "zod";

export interface Role {
  id: string;
  $id?: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  color: string;
  isSystem: boolean;
  level: number;
  created_at: string;
  updated_at: string;
  memberCount?: number;
  permissions?: string[];
}

export interface RolePermission {
  id: string;
  roleId: string;
  permissionKey: string;
  allowed: boolean;
  created_at: string;
}

export interface PermissionAuditLog {
  id: string;
  workspaceId: string;
  actorMemberId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  entityType: "ROLE" | "PERMISSION" | "MEMBER_ROLE" | "PROJECT_OVERRIDE" | "TEAM";
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "ASSIGN";
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  created_at: string;
}

export const createRoleSchema = z.object({
  workspaceId: z.string(),
  name: z.string().trim().min(1, "Role name is required"),
  description: z.string().optional(),
  color: z.string().default("#6366f1"),
  level: z.number().int().min(1).default(30),
  permissions: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  level: z.number().int().min(1).optional(),
  permissions: z.array(z.string()).optional(),
});

export const cloneRoleSchema = z.object({
  name: z.string().trim().min(1, "New role name is required"),
});
