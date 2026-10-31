import "server-only";

import { Databases, ID, Query, getAdminDatabases } from "@/lib/supabase";
import {
  DATABASE_ID,
  MEMBERS_ID,
  PERMISSION_AUDIT_ID,
  PERMISSION_GRANTS_ID,
  PROJECT_MEMBERS_ID,
  ROLE_PERMISSIONS_ID,
  ROLES_ID,
  WORKSPACES_ID,
  ACADEMIC_TEAM_MEMBERS_ID,
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
  const adminDb = getAdminDatabases("permissions:profile");

  // 1. Fetch member and workspace in parallel (using admin client to prevent RLS denial during permission checks)
  const [members, ws] = await Promise.all([
    adminDb.listDocuments<Member & { roleId?: string; reportsToId?: string | null }>(
      DATABASE_ID,
      MEMBERS_ID,
      [
        Query.equal("workspaceId", workspaceId),
        Query.equal("userId", userId),
        Query.limit(1),
      ]
    ).catch(() => databases.listDocuments<Member & { roleId?: string; reportsToId?: string | null }>(
      DATABASE_ID,
      MEMBERS_ID,
      [
        Query.equal("workspaceId", workspaceId),
        Query.equal("userId", userId),
        Query.limit(1),
      ]
    )),
    adminDb.getDocument<{ userId?: string }>(
      DATABASE_ID,
      WORKSPACES_ID,
      workspaceId
    ).catch(() => null),
  ]);

  if (members.total === 0) {
    return null;
  }

  const member = members.documents[0];
  const memberId = member.$id || member.id;
  const isWorkspaceOwner = ws?.userId === userId;
  let roleData: RoleData;

  // 2. Fetch role & role permissions in parallel
  if (member.roleId) {
    try {
      const [roleDoc, permDocs] = await Promise.all([
        adminDb.getDocument<RoleData & { $id: string }>(
          DATABASE_ID,
          ROLES_ID,
          member.roleId
        ),
        adminDb.listDocuments<{ permissionKey: string; allowed: boolean }>(
          DATABASE_ID,
          ROLE_PERMISSIONS_ID,
          [Query.equal("roleId", member.roleId), Query.equal("allowed", true)]
        ),
      ]);

      const dbPermissions = permDocs.documents.map((p) => p.permissionKey);

      // Merge system template permissions so newly added system keys (e.g. college:teams.create)
      // are always available to Project Managers / Faculty Guides / Admins
      const normalizedName = (roleDoc.name || "").toUpperCase().replace(/\s+/g, "_");
      const systemTemplate =
        SYSTEM_ROLE_TEMPLATES[normalizedName as keyof typeof SYSTEM_ROLE_TEMPLATES] ||
        (roleDoc.level <= HIERARCHY_LEVELS.OWNER
          ? SYSTEM_ROLE_TEMPLATES.OWNER
          : roleDoc.level <= HIERARCHY_LEVELS.ADMIN
          ? SYSTEM_ROLE_TEMPLATES.ADMIN
          : roleDoc.level <= HIERARCHY_LEVELS.PROJECT_MANAGER
          ? SYSTEM_ROLE_TEMPLATES.PROJECT_MANAGER
          : null);

      const mergedPermissions = Array.from(
        new Set([...dbPermissions, ...(systemTemplate?.permissions || [])])
      );

      roleData = {
        id: roleDoc.$id || roleDoc.id,
        name: roleDoc.name,
        level: roleDoc.level ?? HIERARCHY_LEVELS.MEMBER,
        isSystem: roleDoc.isSystem ?? false,
        color: roleDoc.color || "#6366f1",
        permissions: mergedPermissions,
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

  // 2b. Academic Team Lead elevation: If member is assigned as LEAD in academic_team_members,
  // grant TEAM_LEAD permissions so they can create/assign group tasks
  try {
    const leadDocs = await adminDb.listDocuments<{ team_id: string; role: string }>(
      DATABASE_ID,
      ACADEMIC_TEAM_MEMBERS_ID,
      [Query.equal("member_id", memberId), Query.equal("role", "LEAD"), Query.limit(1)]
    );
    if (leadDocs.total > 0 && roleData.level > HIERARCHY_LEVELS.TEAM_LEAD) {
      const leadTemplate = SYSTEM_ROLE_TEMPLATES.TEAM_LEAD;
      const existingPerms = Array.isArray(roleData.permissions)
        ? roleData.permissions
        : Object.keys(roleData.permissions).filter((k) => (roleData.permissions as Record<string, boolean>)[k]);
      roleData = {
        name: "Team Lead",
        level: HIERARCHY_LEVELS.TEAM_LEAD,
        isSystem: false,
        color: leadTemplate.color,
        permissions: Array.from(new Set([...existingPerms, ...leadTemplate.permissions])),
      };
    }
  } catch {
    // Non-college workspace or table not queried
  }

  // 3 & 4. Fetch project overrides and temporary grants in parallel
  const [projectMemberDocs, grantDocs] = await Promise.all([
    adminDb.listDocuments<{
      projectId: string;
      roleId?: string | null;
    }>(DATABASE_ID, PROJECT_MEMBERS_ID, [
      Query.equal("memberId", memberId),
    ]).catch(() => ({ total: 0, documents: [] as Array<{ projectId: string; roleId?: string | null }> })),
    adminDb.listDocuments<PermissionGrantData & { id?: string; $id?: string }>(
      DATABASE_ID,
      PERMISSION_GRANTS_ID,
      [
        Query.equal("memberId", memberId),
        Query.equal("revoked", false),
      ]
    ).catch(() => ({ total: 0, documents: [] as Array<PermissionGrantData & { id?: string; $id?: string }> })),
  ]);

  const projectOverrides: Record<string, RoleData> = {};
  if (projectMemberDocs.documents.length > 0) {
    for (const pm of projectMemberDocs.documents) {
      if (pm.roleId) {
        try {
          const [overrideRole, overridePerms] = await Promise.all([
            databases.getDocument<RoleData & { $id: string }>(
              DATABASE_ID,
              ROLES_ID,
              pm.roleId
            ),
            databases.listDocuments<{ permissionKey: string; allowed: boolean }>(
              DATABASE_ID,
              ROLE_PERMISSIONS_ID,
              [Query.equal("roleId", pm.roleId), Query.equal("allowed", true)]
            ),
          ]);

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
  }

  const grants: PermissionGrantData[] = [];
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
