import { HIERARCHY_LEVELS } from "./catalog";

export interface RoleData {
  id?: string;
  name: string;
  level: number;
  isSystem: boolean;
  color?: string;
  permissions: string[] | Record<string, boolean>;
}

export interface PermissionGrantData {
  id?: string;
  permissionKey: string;
  grantType: "ONE_TIME" | "TIME_LIMITED" | "PERMANENT";
  resourceType?: string | null;
  resourceId?: string | null;
  expiresAt?: string | null;
  usesRemaining?: number | null;
  revoked?: boolean;
}

export interface MemberPermissionProfile {
  id: string;
  userId: string;
  workspaceId: string;
  isWorkspaceOwner?: boolean;
  roleId?: string;
  reportsToId?: string | null;
  role: RoleData;
  projectOverrides?: Record<string, RoleData>; // projectId -> RoleData
  grants?: PermissionGrantData[];
}

export interface PermissionContext {
  projectId?: string;
  /** Whether the current user owns the resource (e.g., task assignee, comment author) */
  isOwn?: boolean;
  /** Member ID of the resource owner, compared against the current user's memberId */
  memberId?: string;
  resource?: {
    reporterId?: string | null;
    assigneeId?: string | null;
    authorId?: string | null;
  };
  targetMember?: {
    id: string;
    level: number;
  };
  targetRoleLevel?: number;
  requestedPermissions?: string[];
  allMembers?: Map<string, { id: string; reportsToId?: string | null }>;
}

/**
 * Checks whether targetMemberId reports directly or indirectly to managerMemberId.
 */
export function isReportOf(
  managerMemberId: string,
  targetMemberId: string,
  membersLookup?: Map<string, { id: string; reportsToId?: string | null }>
): boolean {
  if (!membersLookup || !managerMemberId || !targetMemberId) return false;
  if (managerMemberId === targetMemberId) return true;

  let current = membersLookup.get(targetMemberId);
  const visited = new Set<string>();

  while (current && current.reportsToId && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.reportsToId === managerMemberId) {
      return true;
    }
    current = membersLookup.get(current.reportsToId);
  }

  return false;
}

/**
 * Helper to check if a permission array or dictionary has a specific key enabled.
 */
function hasKey(permissions: string[] | Record<string, boolean>, key: string): boolean {
  if (Array.isArray(permissions)) {
    return permissions.includes(key);
  }
  return permissions[key] === true;
}

/**
 * Resolves whether a member is allowed to perform an action.
 *
 * Rules:
 * 1. OWNER bypass: level 0 or role named "Owner" is ALWAYS allowed.
 * 2. Project role override: If projectId is provided and member has a project-specific role,
 *    it takes precedence over the workspace role.
 * 3. Specific permission lookup: Direct permissionKey check.
 * 4. Fallback checks for "own" resources:
 *    - "tasks:edit.any" can fall back to "tasks:edit.own" if user is reporter/assignee.
 *    - "tasks:delete.any" can fall back to "tasks:delete.own" if user is reporter.
 *    - "comments:delete.any" can fall back to "comments:delete.own" if user is author.
 * 5. Anti-escalation safety:
 *    - Cannot manage/assign a role with level <= actor.role.level (except level 0 Owner).
 *    - Cannot grant permissions that actor does not hold themselves.
 */
export function can(
  member: MemberPermissionProfile | null | undefined,
  permissionKey: string,
  context?: PermissionContext
): boolean {
  if (!member || !member.role) {
    return false;
  }

  const role = member.role;

  // 1. Owner always allowed: MUST come from system flag + level 0 OR workspace ownership
  // A custom role named "Owner" gets NO bypass!
  const isOwner =
    member.isWorkspaceOwner === true ||
    (role.isSystem === true && role.level === HIERARCHY_LEVELS.OWNER);
  if (isOwner) {
    return true;
  }

  // 2. Anti-Escalation Checks
  // A. Role management: Cannot create or edit a role with level <= actor level
  if (permissionKey === "roles:manage" && context?.targetRoleLevel !== undefined) {
    if (context.targetRoleLevel <= role.level) {
      return false; // Privilege escalation attempt
    }
  }

  // B. Role assignment: Cannot assign a role at or above actor's level, or change a member with higher/equal rank
  if (permissionKey === "members:roles.assign") {
    if (context?.targetRoleLevel !== undefined && context.targetRoleLevel <= role.level) {
      return false;
    }
    if (context?.targetMember !== undefined && context.targetMember.level <= role.level) {
      return false;
    }
  }

  // C. Invite link creation: Cannot create invite for role at or above actor's level
  if (permissionKey === "invites:manage" && context?.targetRoleLevel !== undefined) {
    if (context.targetRoleLevel <= role.level) {
      return false;
    }
  }

  // D. Cannot grant permissions actor does not have
  if (context?.requestedPermissions && context.requestedPermissions.length > 0) {
    for (const reqPerm of context.requestedPermissions) {
      if (!hasKey(role.permissions, reqPerm)) {
        return false;
      }
    }
  }

  // 3. Resolve effective role (Project override or Workspace role)
  let effectiveRole = role;
  if (context?.projectId && member.projectOverrides && member.projectOverrides[context.projectId]) {
    effectiveRole = member.projectOverrides[context.projectId];
    // If project override role is a system role with level 0, allow immediately
    if (effectiveRole.isSystem === true && effectiveRole.level === HIERARCHY_LEVELS.OWNER) {
      return true;
    }
  }

  // 4. Direct Permission Check
  if (hasKey(effectiveRole.permissions, permissionKey)) {
    return true;
  }

  // 4b. Active temporary or resource-scoped grants check
  if (member.grants && member.grants.length > 0) {
    const now = new Date();
    for (const grant of member.grants) {
      if (grant.revoked) continue;
      if (grant.permissionKey !== permissionKey) continue;
      if (grant.expiresAt && new Date(grant.expiresAt) <= now) continue;
      if (grant.usesRemaining !== undefined && grant.usesRemaining !== null && grant.usesRemaining <= 0) continue;
      if (grant.resourceId && context?.projectId && grant.resourceId !== context.projectId) continue;

      return true;
    }
  }

  // 5. Context-aware "own" fallbacks
  if (permissionKey === "tasks:edit.any") {
    if (hasKey(effectiveRole.permissions, "tasks:edit.own")) {
      // If resource is given, verify ownership
      if (context?.resource) {
        const isReporter = context.resource.reporterId === member.id;
        const isAssignee = context.resource.assigneeId === member.id;
        if (isReporter || isAssignee) {
          return true;
        }
        // Also allow if the assignee/reporter is a direct report of this member
        if (
          context.allMembers &&
          context.resource.assigneeId &&
          isReportOf(member.id, context.resource.assigneeId, context.allMembers)
        ) {
          return true;
        }
      } else {
        // If no resource given (general UI check), member has partial edit capability
        return true;
      }
    }
  }

  if (permissionKey === "tasks:delete.any") {
    if (hasKey(effectiveRole.permissions, "tasks:delete.own")) {
      if (context?.resource) {
        return context.resource.reporterId === member.id;
      }
      return false;
    }
  }

  if (permissionKey === "comments:delete.any") {
    if (hasKey(effectiveRole.permissions, "comments:delete.own")) {
      if (context?.resource) {
        return context.resource.authorId === member.id;
      }
      return false;
    }
  }

  // 6. View everything check
  if (permissionKey === "tasks:view.all") {
    if (hasKey(effectiveRole.permissions, "tasks:view.assigned_only")) {
      if (context?.resource) {
        const isAssignee = context.resource.assigneeId === member.id;
        if (isAssignee) return true;
        // Direct reports view
        if (
          context.allMembers &&
          context.resource.assigneeId &&
          isReportOf(member.id, context.resource.assigneeId, context.allMembers)
        ) {
          return true;
        }
        return false;
      }
      return false; // Can't view all unconditionally
    }
  }

  return false;
}

/**
 * Creates an effective permissions map for delivery to the client.
 */
export function getEffectivePermissions(
  member: MemberPermissionProfile | null | undefined,
  projectId?: string
): Record<string, boolean> {
  if (!member || !member.role) {
    return {};
  }

  // Owner has all permissions
  if (member.role.level === HIERARCHY_LEVELS.OWNER || member.role.name.toLowerCase() === "owner") {
    const all: Record<string, boolean> = {};
    // Import all keys
    return new Proxy(all, {
      get: () => true,
    });
  }

  let effectiveRole = member.role;
  if (projectId && member.projectOverrides && member.projectOverrides[projectId]) {
    effectiveRole = member.projectOverrides[projectId];
  }

  const result: Record<string, boolean> = {};
  if (Array.isArray(effectiveRole.permissions)) {
    for (const key of effectiveRole.permissions) {
      result[key] = true;
    }
  } else {
    Object.assign(result, effectiveRole.permissions);
  }

  if (member.grants) {
    const now = new Date();
    for (const g of member.grants) {
      if (g.revoked) continue;
      if (g.expiresAt && new Date(g.expiresAt) <= now) continue;
      if (g.usesRemaining !== undefined && g.usesRemaining !== null && g.usesRemaining <= 0) continue;
      if (g.resourceId && projectId && g.resourceId !== projectId) continue;
      result[g.permissionKey] = true;
    }
  }

  return result;
}
