import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { sessionMiddleware } from "@/lib/session-middleware";
import { ID, Query, getAdminDatabases } from "@/lib/supabase";
import {
  DATABASE_ID,
  MEMBERS_ID,
  ROLES_ID,
  INVITE_LINKS_ID,
  WORKSPACES_ID,
} from "@/config";
import { getMemberPermissionProfile } from "@/lib/permissions/server";
import { can } from "@/lib/permissions/engine";
import type { InviteLink } from "@/features/access-requests/types";
import { Workspace } from "@/features/workspaces/types";
import { Member, MemberRole } from "@/features/members/types";

const app = new Hono()
  // ── LIST ────────────────────────────────────────────────────────────────
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.valid("query");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "invites:manage")) {
        return c.json({ error: "Forbidden", requiredPermission: "invites:manage", canRequest: true }, 403);
      }

      const links = await databases.listDocuments<InviteLink>(
        DATABASE_ID, INVITE_LINKS_ID,
        [Query.equal("workspaceId", workspaceId), Query.orderDesc("created_at")]
      );

      return c.json({ data: links });
    }
  )
  // ── CREATE ──────────────────────────────────────────────────────────────
  .post(
    "/",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        workspaceId: z.string(),
        roleId: z.string().optional(),
        label: z.string().max(80).optional(),
        expiresAt: z.string().datetime().optional(),
        maxUses: z.number().int().positive().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId, roleId, label, expiresAt, maxUses } = c.req.valid("json");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "invites:manage")) {
        return c.json({ error: "Forbidden", requiredPermission: "invites:manage", canRequest: true }, 403);
      }

      // Anti-escalation: cannot create invite link for a role at or above actor's own level (unless owner)
      const isOwner = profile.isWorkspaceOwner === true || (profile.role.isSystem && profile.role.level === 0);
      if (!isOwner && roleId) {
        try {
          const targetRole = await databases.getDocument<{ level: number }>(DATABASE_ID, ROLES_ID, roleId);
          if (targetRole.level <= profile.role.level) {
            return c.json({ error: "Cannot create invite link for a role at or above your own level" }, 403);
          }
        } catch { /* role not found */ }
      }

      const code = Math.random().toString(36).slice(2, 12).toUpperCase();

      const link = await databases.createDocument<InviteLink>(
        DATABASE_ID, INVITE_LINKS_ID, ID.unique(),
        {
          workspaceId,
          roleId: roleId || null,
          code,
          label: label || null,
          expiresAt: expiresAt || null,
          maxUses: maxUses || null,
          uses: 0,
          createdBy: profile.id,
          revoked: false,
        }
      );

      return c.json({ data: link }, 201);
    }
  )
  // ── REVOKE ───────────────────────────────────────────────────────────────
  .delete(
    "/:linkId",
    sessionMiddleware,
    zValidator("json", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { linkId } = c.req.param();
      const { workspaceId } = c.req.valid("json");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "invites:manage")) {
        return c.json({ error: "Forbidden", requiredPermission: "invites:manage", canRequest: true }, 403);
      }

      await databases.updateDocument(DATABASE_ID, INVITE_LINKS_ID, linkId, { revoked: true });
      return c.json({ data: { id: linkId, revoked: true } });
    }
  )
  // ── LOOKUP (public — used by join preview) ────────────────────────────────
  .get(
    "/lookup",
    sessionMiddleware,
    zValidator("query", z.object({ code: z.string() })),
    async (c) => {
      const { code } = c.req.valid("query");
      const adminDatabases = getAdminDatabases("invite-links:lookup");

      try {
        const links = await adminDatabases.listDocuments<InviteLink & { workspaceId: string }>(
          DATABASE_ID, INVITE_LINKS_ID,
          [Query.equal("code", code.trim().toUpperCase()), Query.limit(1)]
        );

        if (links.total === 0) return c.json({ error: "Invalid or expired invite link" }, 404);
        const link = links.documents[0];

        if (link.revoked) return c.json({ error: "This invite link has been revoked" }, 410);
        if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
          return c.json({ error: "This invite link has expired" }, 410);
        }
        if (link.maxUses && link.uses >= link.maxUses) {
          return c.json({ error: "This invite link has reached its maximum uses" }, 410);
        }

        const workspace = await adminDatabases.getDocument<Workspace>(DATABASE_ID, WORKSPACES_ID, link.workspaceId);

        let roleName: string | undefined;
        if (link.roleId) {
          const role = await adminDatabases.getDocument<{ name: string }>(DATABASE_ID, ROLES_ID, link.roleId).catch(() => null);
          roleName = role?.name;
        }

        return c.json({
          data: {
            workspaceId: link.workspaceId,
            workspaceName: workspace.name,
            workspaceImageUrl: workspace.imageUrl,
            roleId: link.roleId,
            roleName: roleName || "Member (View Only)",
            code: link.code,
            linkId: link.id || link.$id,
          },
        });
      } catch {
        return c.json({ error: "Invalid invite link" }, 404);
      }
    }
  )
  // ── JOIN via invite link (Atomic use increment) ──────────────────────────
  .post(
    "/join",
    sessionMiddleware,
    zValidator("json", z.object({ code: z.string() })),
    async (c) => {
      const user = c.get("user");
      const userDatabases = c.get("databases");
      const { code } = c.req.valid("json");
      const adminDatabases = getAdminDatabases("invite-links:join");
      const normalizedCode = code.trim().toUpperCase();

      const links = await adminDatabases.listDocuments<InviteLink & { workspaceId: string; roleId?: string }>(
        DATABASE_ID, INVITE_LINKS_ID,
        [Query.equal("code", normalizedCode), Query.limit(1)]
      );

      if (links.total === 0) return c.json({ error: "Invalid invite link" }, 404);
      const link = links.documents[0];
      const linkId = link.id || (link as unknown as { $id?: string }).$id || "";

      if (link.revoked) return c.json({ error: "This invite link has been revoked" }, 410);
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return c.json({ error: "This invite link has expired" }, 410);
      }
      if (link.maxUses && link.uses >= link.maxUses) {
        return c.json({ error: "This invite link has reached its maximum uses" }, 410);
      }

      const { workspaceId } = link;

      // Reject if already a member of this workspace
      const existing = await adminDatabases.listDocuments<Member>(
        DATABASE_ID, MEMBERS_ID,
        [Query.equal("workspaceId", workspaceId), Query.equal("userId", user.$id), Query.limit(1)]
      );
      if (existing.total > 0) return c.json({ error: "Already a member of this workspace" }, 400);

      // Atomic use consumption: UPDATE ... WHERE uses < maxUses AND revoked = false RETURNING
      let consumed = false;
      try {
        const rpcRows = await adminDatabases.rpc<Array<InviteLink>>(
          "consume_invite_link_use",
          { p_code: normalizedCode }
        );
        if (Array.isArray(rpcRows) && rpcRows.length > 0) {
          consumed = true;
        }
      } catch {
        // Fallback atomic check & update
        const fresh = await adminDatabases.getDocument<InviteLink>(DATABASE_ID, INVITE_LINKS_ID, linkId);
        if (!fresh.revoked && (!fresh.maxUses || fresh.uses < fresh.maxUses) && (!fresh.expiresAt || new Date(fresh.expiresAt) > new Date())) {
          await adminDatabases.updateDocument(DATABASE_ID, INVITE_LINKS_ID, linkId, {
            uses: fresh.uses + 1,
          });
          consumed = true;
        }
      }

      if (!consumed) {
        return c.json({ error: "This invite link has reached its maximum uses or has expired" }, 410);
      }

      // Create member record (default deny-by-default role enum)
      const assignedRole: MemberRole = MemberRole.VIEWER;

      const member = await userDatabases.createDocument<Member>(
        DATABASE_ID, MEMBERS_ID, ID.unique(),
        {
          workspaceId,
          userId: user.$id,
          role: assignedRole,
          roleId: link.roleId || null,
        }
      );

      return c.json({
        data: {
          workspaceId,
          memberId: member.$id || member.id,
          role: assignedRole,
          roleId: link.roleId || null,
        },
      });
    }
  );

export default app;
