import "server-only";

import { Databases, ID, Query } from "@/lib/supabase";
import {
  DATABASE_ID,
  MEMBERS_ID,
  PERMISSION_AUDIT_ID,
  PERMISSION_GRANTS_ID,
  PROJECT_MEMBERS_ID,
  ROLE_PERMISSIONS_ID,
  ROLES_ID,
  WORKSPACES_ID,
} from "@/config";
import { Member } from "@/features/members/types";
import { MemberPermissionProfile, RoleData, PermissionGrantData } from "./engine";
import { HIERARCHY_LEVELS, SYSTEM_ROLE_TEMPLATES } from "./catalog";

/**
 * Loads the complete permission profile for a member in a workspace.
 */
export async function getMemberPermissionProfile(
  databases: Databases,
  workspaceId: string,
  userId: string
): Promise<MemberPermissionProfile | null> {
  // 1. Fetch member
  const members = await databases.listDocuments<Member & { roleId?: string; reportsToId?: string | null }>(
    DATABASE_ID,
    MEMBERS_ID,
    [
      Query.equal("workspaceId", workspaceId),
      Query.equal("userId", userId),
      Query.limit(1),
    ]
  );

  if (members.total === 0) {
    return null;
  }

  const member = members.documents[0];
  const memberId = member.$id || member.id;
  let roleData: RoleData;

  // Check if caller is workspace owner (by creator userId)
  let isWorkspaceOwner = false;
  try {
    const ws = await databases.getDocument<{ userId?: string }>(
      DATABASE_ID,
      WORKSPACES_ID,
      workspaceId
    );
    if (ws && ws.userId === userId) {
      isWorkspaceOwner = true;
    }
  } catch {
    // If table not accessible or lookup fails
  }

  // 2. Fetch role
  if (member.roleId) {
    try {
      const roleDoc = await databases.getDocument<RoleData & { $id: string }>(
        DATABASE_ID,
        ROLES_ID,
        member.roleId
      );

      // Fetch role permissions
      const permDocs = await databases.listDocuments<{ permissionKey: string; allowed: boolean }>(
        DATABASE_ID,
        ROLE_PERMISSIONS_ID,
        [Query.equal("roleId", member.roleId), Query.equal("allowed", true)]
      );

      const permissions = permDocs.documents.map((p) => p.permissionKey);

      roleData = {
        id: roleDoc.$id || roleDoc.id,
        name: roleDoc.name,
        level: roleDoc.level ?? HIERARCHY_LEVELS.MEMBER,
        isSystem: roleDoc.isSystem ?? false,
        color: roleDoc.color || "#6366f1",
        permissions,
      };
    } catch {
      // Fallback to text role if role doc lookup fails
      const fallbackTemplate =
        SYSTEM_ROLE_TEMPLATES[member.role] || SYSTEM_ROLE_TEMPLATES.MEMBER;
      roleData = {
        name: fallbackTemplate.name,
        level: fallbackTemplate.level,
        isSystem: fallbackTemplate.isSystem,
        color: fallbackTemplate.color,
        permissions: fallbackTemplate.permissions,
      };
    }
  } else {
    // Legacy fallback before 003 migration is run in Supabase
    const fallbackTemplate =
      SYSTEM_ROLE_TEMPLATES[member.role] || SYSTEM_ROLE_TEMPLATES.MEMBER;
    roleData = {
      name: fallbackTemplate.name,
      level: fallbackTemplate.level,
      isSystem: fallbackTemplate.isSystem,
      color: fallbackTemplate.color,
      permissions: fallbackTemplate.permissions,
    };
  }

  // 3. Fetch project role overrides
  const projectOverrides: Record<string, RoleData> = {};
  try {
    const projectMemberDocs = await databases.listDocuments<{
      projectId: string;
      roleId?: string | null;
    }>(DATABASE_ID, PROJECT_MEMBERS_ID, [
      Query.equal("memberId", memberId),
    ]);

    for (const pm of projectMemberDocs.documents) {
      if (pm.roleId) {
        try {
          const overrideRole = await databases.getDocument<RoleData & { $id: string }>(
            DATABASE_ID,
            ROLES_ID,
            pm.roleId
          );
          const overridePerms = await databases.listDocuments<{ permissionKey: string; allowed: boolean }>(
            DATABASE_ID,
            ROLE_PERMISSIONS_ID,
            [Query.equal("roleId", pm.roleId), Query.equal("allowed", true)]
          );
          projectOverrides[pm.projectId] = {
            id: overrideRole.$id || overrideRole.id,
            name: overrideRole.name,
            level: overrideRole.level ?? HIERARCHY_LEVELS.MEMBER,
            isSystem: overrideRole.isSystem ?? false,
            color: overrideRole.color || "#6366f1",
            permissions: overridePerms.documents.map((p) => p.permissionKey),
          };
        } catch {
          // ignore override lookup failure
        }
      }
    }
  } catch {
    // Table not yet migrated
  }

  // 4. Fetch active temporary grants
  const grants: PermissionGrantData[] = [];
  try {
    const grantDocs = await databases.listDocuments<PermissionGrantData & { id?: string; $id?: string }>(
      DATABASE_ID,
      PERMISSION_GRANTS_ID,
      [
        Query.equal("memberId", memberId),
        Query.equal("revoked", false),
      ]
    );
    const now = new Date();
    for (const doc of grantDocs.documents) {
      if (doc.expiresAt && new Date(doc.expiresAt) <= now) continue;
      if (doc.usesRemaining !== undefined && doc.usesRemaining !== null && doc.usesRemaining <= 0) continue;
      grants.push({
        id: doc.$id || doc.id,
        permissionKey: doc.permissionKey,
        grantType: doc.grantType,
        resourceType: doc.resourceType,
        resourceId: doc.resourceId,
        expiresAt: doc.expiresAt,
        usesRemaining: doc.usesRemaining,
        revoked: doc.revoked,
      });
    }
  } catch {
    // Table not yet migrated
  }

  return {
    id: memberId,
    userId: member.userId,
    workspaceId: member.workspaceId,
    isWorkspaceOwner,
    roleId: member.roleId,
    reportsToId: member.reportsToId || null,
    role: roleData,
    projectOverrides,
    grants,
  };
}

/**
 * Consumes a one-time grant use atomically via databases.rpc
 */
export async function consumeGrant(
  databases: Databases,
  grantId: string
): Promise<boolean> {
  try {
    return await databases.rpc<boolean>("consume_grant_use", {
      p_grant_id: grantId,
    });
  } catch (err) {
    console.error("Failed to consume grant use:", err);
    return false;
  }
}

/**
 * Audit log helper: Writes a record of any role/permission/member assignment changes.
 */
export async function logPermissionAudit(
  databases: Databases,
  params: {
    workspaceId: string;
    actorMemberId?: string | null;
    entityType: "ROLE" | "PERMISSION" | "MEMBER_ROLE" | "PROJECT_OVERRIDE" | "TEAM";
    entityId: string;
    action: "CREATE" | "UPDATE" | "DELETE" | "ASSIGN";
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  }
): Promise<void> {
  try {
    await databases.createDocument(
      DATABASE_ID,
      PERMISSION_AUDIT_ID,
      ID.unique(),
      {
        workspaceId: params.workspaceId,
        actorMemberId: params.actorMemberId || null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        oldValues: params.oldValues ? JSON.stringify(params.oldValues) : null,
        newValues: params.newValues ? JSON.stringify(params.newValues) : null,
      }
    );
  } catch (err) {
    console.warn("Notice: permission audit logging skipped (table may not exist yet):", err);
  }
}
