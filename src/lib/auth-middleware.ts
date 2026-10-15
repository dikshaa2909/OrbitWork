import "server-only";

import { createMiddleware } from "hono/factory";
import { getMemberPermissionProfile } from "@/lib/permissions/server";
import { can, type MemberPermissionProfile, type PermissionContext } from "@/lib/permissions/engine";
import type { Databases, AuthUser, Account, Storage, Users } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------
type AuthVars = {
  Variables: {
    account: Account;
    databases: Databases;
    storage: Storage;
    users: Users;
    user: AuthUser;
    permissionProfile: MemberPermissionProfile;
    workspaceId: string;
  };
};

// ---------------------------------------------------------------------------
// requireWorkspaceMember
// Loads the caller's MemberPermissionProfile for a workspaceId (from query,
// body, or path params) and attaches it to c.var.permissionProfile.
// Returns 401 if not a member.
// ---------------------------------------------------------------------------
export const requireWorkspaceMember = (
  getWorkspaceId: (c: Parameters<ReturnType<typeof createMiddleware<AuthVars>>>[0]) => string | undefined
) =>
  createMiddleware<AuthVars>(async (c, next) => {
    const databases = c.get("databases");
    const user = c.get("user");

    const workspaceId = getWorkspaceId(c);
    if (!workspaceId) {
      return c.json({ error: "Missing workspaceId" }, 400);
    }

    const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
    if (!profile) {
      return c.json(
        { error: "Unauthorized: you are not a member of this workspace" },
        401
      );
    }

    c.set("permissionProfile", profile);
    c.set("workspaceId", workspaceId);
    await next();
  });

// ---------------------------------------------------------------------------
// requirePermission
// Must run AFTER requireWorkspaceMember (profile must be on context).
// Returns 403 with { error, requiredPermission, canRequest: true } on denial.
// ---------------------------------------------------------------------------
export const requirePermission = (
  permissionKey: string,
  getContext?: (c: Parameters<ReturnType<typeof createMiddleware<AuthVars>>>[0]) => PermissionContext | undefined
) =>
  createMiddleware<AuthVars>(async (c, next) => {
    const profile = c.get("permissionProfile");
    if (!profile) {
      return c.json({ error: "Unauthorized: no permission profile loaded" }, 401);
    }

    const ctx = getContext ? getContext(c) : undefined;
    if (!can(profile, permissionKey, ctx)) {
      return c.json(
        {
          error: `Forbidden: you need the '${permissionKey}' permission to perform this action`,
          requiredPermission: permissionKey,
          canRequest: true,
        },
        403
      );
    }

    await next();
  });

// ---------------------------------------------------------------------------
// Helper: extract workspaceId from common locations in Hono request
// ---------------------------------------------------------------------------
export function wsFromQuery(c: { req: { valid: (t: "query") => Record<string, string> } }): string | undefined {
  try {
    return (c.req.valid("query") as Record<string, string>)?.workspaceId;
  } catch {
    return undefined;
  }
}

export function wsFromParam(c: { req: { param: () => Record<string, string> } }): string | undefined {
  return c.req.param()?.workspaceId;
}

export function wsFromJson(c: { req: { valid: (t: "json") => Record<string, string> } }): string | undefined {
  try {
    return (c.req.valid("json") as Record<string, string>)?.workspaceId;
  } catch {
    return undefined;
  }
}
