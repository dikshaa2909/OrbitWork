import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

import { ID, Query, createAdminClient } from "@/lib/supabase";
import { sessionMiddleware } from "@/lib/session-middleware";
import {
  DATABASE_ID,
  MEMBERS_ID,
  PERMISSION_AUDIT_ID,
  ROLE_PERMISSIONS_ID,
  ROLES_ID,
} from "@/config";
import { can, getEffectivePermissions } from "@/lib/permissions/engine";
import { getMemberPermissionProfile, logPermissionAudit } from "@/lib/permissions/server";
import { HIERARCHY_LEVELS } from "@/lib/permissions/catalog";
import {
  cloneRoleSchema,
  createRoleSchema,
  Role,
  updateRoleSchema,
} from "../types";

const app = new Hono()
  // 1. List all roles for workspace with member counts & permissions
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.valid("query");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Fetch all roles for workspace
      let roles: Role[] = [];
      try {
        const rolesDocs = await databases.listDocuments<Role>(
          DATABASE_ID,
          ROLES_ID,
          [Query.equal("workspaceId", workspaceId), Query.orderAsc("level")]
        );

        // Fetch all role_permissions for workspace roles
        const roleIds = rolesDocs.documents.map((r) => r.id || (r.$id as string));
        const permsDocs =
          roleIds.length > 0
            ? await databases.listDocuments<{ roleId: string; permissionKey: string; allowed: boolean }>(
                DATABASE_ID,
                ROLE_PERMISSIONS_ID,
                [Query.contains("roleId", roleIds), Query.equal("allowed", true)]
              )
            : { documents: [] };

        // Fetch members to count per role
        const membersDocs = await databases.listDocuments<{ roleId?: string; role?: string }>(
          DATABASE_ID,
          MEMBERS_ID,
          [Query.equal("workspaceId", workspaceId)]
        );

        roles = rolesDocs.documents.map((r) => {
          const roleId = r.id || (r.$id as string);
          const rolePerms = permsDocs.documents
            .filter((p) => p.roleId === roleId)
            .map((p) => p.permissionKey);

          const memberCount = membersDocs.documents.filter(
            (m) => m.roleId === roleId || (m.role && m.role.toLowerCase() === r.name.toLowerCase())
          ).length;

          return {
            ...r,
            id: roleId,
            memberCount,
            permissions: rolePerms,
          };
        });
      } catch {
        // Table not migrated yet; fallback
        roles = [];
      }

      return c.json({ data: roles });
    }
  )

  // 2. Get current user's effective permissions (supports previewRoleId)
  .get(
    "/effective",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        projectId: z.string().optional(),
        previewRoleId: z.string().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId, projectId, previewRoleId } = c.req.valid("query");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // If previewing as a role, only allow if actor is Admin or Owner
      if (previewRoleId && (profile.role.level <= HIERARCHY_LEVELS.ADMIN || profile.role.name.toLowerCase() === "owner")) {
        try {
          const previewRoleDoc = await databases.getDocument<Role>(DATABASE_ID, ROLES_ID, previewRoleId);
          const permsDocs = await databases.listDocuments<{ permissionKey: string; allowed: boolean }>(
            DATABASE_ID,
            ROLE_PERMISSIONS_ID,
            [Query.equal("roleId", previewRoleId), Query.equal("allowed", true)]
          );
          const previewPermissions: Record<string, boolean> = {};
          for (const p of permsDocs.documents) {
            previewPermissions[p.permissionKey] = true;
          }

          return c.json({
            data: {
              permissions: previewPermissions,
              role: {
                id: previewRoleDoc.id,
                name: previewRoleDoc.name,
                level: previewRoleDoc.level,
                color: previewRoleDoc.color,
                isSystem: previewRoleDoc.isSystem,
              },
              isPreview: true,
            },
          });
        } catch {
          // ignore error and proceed with real profile
        }
      }

      const effective = getEffectivePermissions(profile, projectId);

      return c.json({
        data: {
          permissions: effective,
          role: profile.role,
          isPreview: false,
        },
      });
    }
  )

  // 3. Create Custom Role
  .post(
    "/",
    sessionMiddleware,
    zValidator("json", createRoleSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId, name, description, color, level, permissions } = c.req.valid("json");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Check roles:manage permission and anti-escalation
      const isAllowed = can(profile, "roles:manage", {
        targetRoleLevel: level,
        requestedPermissions: permissions,
      });

      if (!isAllowed) {
        return c.json(
          {
            error:
              "Forbidden: you do not have permission to create this role or grant permissions you do not hold.",
          },
          403
        );
      }

      // Insert role
      const roleId = ID.unique();
      const role = await databases.createDocument<Role>(DATABASE_ID, ROLES_ID, roleId, {
        workspaceId,
        name,
        description: description || null,
        color: color || "#6366f1",
        isSystem: false,
        level: level || HIERARCHY_LEVELS.MEMBER,
      });

      // Insert permissions
      if (permissions && permissions.length > 0) {
        for (const permKey of permissions) {
          await databases.createDocument(DATABASE_ID, ROLE_PERMISSIONS_ID, ID.unique(), {
            roleId,
            permissionKey: permKey,
            allowed: true,
          });
        }
      }

      // Audit log
      await logPermissionAudit(databases, {
        workspaceId,
        actorMemberId: profile.id,
        entityType: "ROLE",
        entityId: roleId,
        action: "CREATE",
        newValues: { name, level, permissionsCount: permissions.length },
      });

      return c.json({ data: { ...role, id: roleId, permissions } });
    }
  )

  // 4. Update Role Details & Permissions
  .patch(
    "/:roleId",
    sessionMiddleware,
    zValidator("json", updateRoleSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { roleId } = c.req.param();
      const { name, description, color, level, permissions } = c.req.valid("json");

      const existingRole = await databases.getDocument<Role>(DATABASE_ID, ROLES_ID, roleId);
      const profile = await getMemberPermissionProfile(databases, existingRole.workspaceId, user.$id);

      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Cannot modify Owner role unless actor is Owner
      if (existingRole.level === HIERARCHY_LEVELS.OWNER && profile.role.level !== HIERARCHY_LEVELS.OWNER) {
        return c.json({ error: "Forbidden: only the workspace owner can modify the Owner role" }, 403);
      }

      // Anti-escalation check
      const isAllowed = can(profile, "roles:manage", {
        targetRoleLevel: existingRole.level,
        requestedPermissions: permissions,
      });

      if (!isAllowed) {
        return c.json({ error: "Forbidden: privilege escalation prevented" }, 403);
      }

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (color !== undefined) updates.color = color;
      if (level !== undefined && !existingRole.isSystem) updates.level = level;

      const updatedRole = await databases.updateDocument<Role>(
        DATABASE_ID,
        ROLES_ID,
        roleId,
        updates
      );

      // If permissions are updated, sync role_permissions table
      if (permissions !== undefined) {
        // Delete existing permissions for role
        const oldPermsDocs = await databases.listDocuments<{ $id: string; permissionKey: string }>(
          DATABASE_ID,
          ROLE_PERMISSIONS_ID,
          [Query.equal("roleId", roleId)]
        );
        for (const p of oldPermsDocs.documents) {
          await databases.deleteDocument(DATABASE_ID, ROLE_PERMISSIONS_ID, p.$id);
        }

        // Insert new permissions
        for (const permKey of permissions) {
          await databases.createDocument(DATABASE_ID, ROLE_PERMISSIONS_ID, ID.unique(), {
            roleId,
            permissionKey: permKey,
            allowed: true,
          });
        }
      }

      // Audit log
      await logPermissionAudit(databases, {
        workspaceId: existingRole.workspaceId,
        actorMemberId: profile.id,
        entityType: "ROLE",
        entityId: roleId,
        action: "UPDATE",
        oldValues: { name: existingRole.name, level: existingRole.level },
        newValues: { name: updates.name || existingRole.name, permissionsCount: permissions?.length },
      });

      return c.json({ data: updatedRole });
    }
  )

  // 5. Delete Custom Role (requires member reassignment if members exist)
  .delete(
    "/:roleId",
    sessionMiddleware,
    zValidator("query", z.object({ reassignToRoleId: z.string().optional() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { roleId } = c.req.param();
      const { reassignToRoleId } = c.req.valid("query");

      const existingRole = await databases.getDocument<Role>(DATABASE_ID, ROLES_ID, roleId);
      const profile = await getMemberPermissionProfile(databases, existingRole.workspaceId, user.$id);

      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // System roles cannot be deleted
      if (existingRole.isSystem) {
        return c.json({ error: "System roles cannot be deleted" }, 400);
      }

      const isAllowed = can(profile, "roles:manage", {
        targetRoleLevel: existingRole.level,
      });

      if (!isAllowed) {
        return c.json({ error: "Forbidden: cannot delete a role at or above your level" }, 403);
      }

      // Check assigned members
      const assignedMembers = await databases.listDocuments<{ $id: string }>(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("roleId", roleId)]
      );

      if (assignedMembers.total > 0) {
        if (!reassignToRoleId) {
          return c.json(
            {
              error: `Role has ${assignedMembers.total} member(s). Please specify a replacement role (reassignToRoleId).`,
            },
            400
          );
        }

        // Reassign members
        for (const m of assignedMembers.documents) {
          await databases.updateDocument(DATABASE_ID, MEMBERS_ID, m.$id, {
            roleId: reassignToRoleId,
          });
        }
      }

      // Delete role permissions
      const permsDocs = await databases.listDocuments<{ $id: string }>(
        DATABASE_ID,
        ROLE_PERMISSIONS_ID,
        [Query.equal("roleId", roleId)]
      );
      for (const p of permsDocs.documents) {
        await databases.deleteDocument(DATABASE_ID, ROLE_PERMISSIONS_ID, p.$id);
      }

      // Delete role
      await databases.deleteDocument(DATABASE_ID, ROLES_ID, roleId);

      // Audit log
      await logPermissionAudit(databases, {
        workspaceId: existingRole.workspaceId,
        actorMemberId: profile.id,
        entityType: "ROLE",
        entityId: roleId,
        action: "DELETE",
        oldValues: { name: existingRole.name },
      });

      return c.json({ data: { id: roleId } });
    }
  )

  // 6. Clone Role
  .post(
    "/:roleId/clone",
    sessionMiddleware,
    zValidator("json", cloneRoleSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { roleId } = c.req.param();
      const { name } = c.req.valid("json");

      const existingRole = await databases.getDocument<Role>(DATABASE_ID, ROLES_ID, roleId);
      const profile = await getMemberPermissionProfile(databases, existingRole.workspaceId, user.$id);

      if (!profile || !can(profile, "roles:manage")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Fetch source permissions
      const permsDocs = await databases.listDocuments<{ permissionKey: string; allowed: boolean }>(
        DATABASE_ID,
        ROLE_PERMISSIONS_ID,
        [Query.equal("roleId", roleId), Query.equal("allowed", true)]
      );

      const newRoleId = ID.unique();
      const newRole = await databases.createDocument<Role>(DATABASE_ID, ROLES_ID, newRoleId, {
        workspaceId: existingRole.workspaceId,
        name,
        description: `Copy of ${existingRole.name}`,
        color: existingRole.color || "#6366f1",
        isSystem: false,
        level: Math.max(existingRole.level, HIERARCHY_LEVELS.PROJECT_MANAGER), // Custom clones cannot be level 0/10
      });

      for (const p of permsDocs.documents) {
        await databases.createDocument(DATABASE_ID, ROLE_PERMISSIONS_ID, ID.unique(), {
          roleId: newRoleId,
          permissionKey: p.permissionKey,
          allowed: true,
        });
      }

      return c.json({ data: newRole });
    }
  )

  // 7. Audit Log History
  .get(
    "/audit",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string(), limit: z.string().optional() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { users } = await createAdminClient();
      const { workspaceId, limit } = c.req.valid("query");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile || !can(profile, "audit:view")) {
        return c.json({ error: "Forbidden: requires audit:view permission" }, 403);
      }

      try {
        const auditDocs = await databases.listDocuments(
          DATABASE_ID,
          PERMISSION_AUDIT_ID,
          [
            Query.equal("workspaceId", workspaceId),
            Query.orderDesc("created_at"),
            Query.limit(limit ? parseInt(limit, 10) : 50),
          ]
        );

        // Populate actor names
        const populated = await Promise.all(
          auditDocs.documents.map(async (doc: Record<string, unknown>) => {
            let actorName = "System";
            let actorEmail = "";
            if (doc.actorMemberId) {
              try {
                const member = await databases.getDocument<{ userId: string }>(
                  DATABASE_ID,
                  MEMBERS_ID,
                  doc.actorMemberId as string
                );
                const u = await users.get(member.userId);
                actorName = u.name || u.email;
                actorEmail = u.email;
              } catch {
                // ignore
              }
            }

            return {
              ...doc,
              actorName,
              actorEmail,
            };
          })
        );

        return c.json({ data: populated });
      } catch {
        return c.json({ data: [] });
      }
    }
  );

export default app;
