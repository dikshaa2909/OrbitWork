import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { sessionMiddleware } from "@/lib/session-middleware";
import { ID, Query, createAdminClient } from "@/lib/supabase";
import {
  ACCESS_REQUESTS_ID,
  DATABASE_ID,
  MEMBERS_ID,
  NOTIFICATIONS_ID,
  PERMISSION_GRANTS_ID,
} from "@/config";
import { getMemberPermissionProfile, logPermissionAudit } from "@/lib/permissions/server";
import { can } from "@/lib/permissions/engine";
import type { AccessRequest, PermissionGrant } from "../types";
import { Member } from "@/features/members/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function sendNotification(params: {
    workspaceId: string;
    userId: string;
    type: string;
    title: string;
    body?: string;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
  }
) {
  try {
    // We get admin client inline to bypass RLS for notification insert
    const { databases } = await createAdminClient();
    await databases.createDocument(DATABASE_ID, NOTIFICATIONS_ID, ID.unique(), {
      workspaceId: params.workspaceId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body || null,
      entityType: params.entityType || null,
      entityId: params.entityId || null,
      actionUrl: params.actionUrl || null,
      read: false,
    });
  } catch (err) {
    console.warn("Notification insert failed (table may not exist yet):", err);
  }
}

async function notifyReviewers(
  workspaceId: string,
  request: { id: string; permissionKey: string; requesterName: string }
) {
  try {
    const { databases } = await createAdminClient();
    // Get all members who can review requests
    const members = await databases.listDocuments<Member & { userId: string; roleId?: string }>(
      DATABASE_ID, MEMBERS_ID, [Query.equal("workspaceId", workspaceId)]
    );
    for (const m of members.documents) {
      const profile = await getMemberPermissionProfile(databases, workspaceId, m.userId).catch(() => null);
      if (profile && can(profile, "requests:review")) {
        await sendNotification({
          workspaceId,
          userId: m.userId,
          type: "access_request",
          title: `${request.requesterName} requested access`,
          body: `Permission: ${request.permissionKey}`,
          entityType: "access_request",
          entityId: request.id,
          actionUrl: `/workspaces/${workspaceId}/settings/requests`,
        });
      }
    }
  } catch (err) {
    console.warn("Failed to notify reviewers:", err);
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
const app = new Hono()
  // ── CREATE REQUEST ──────────────────────────────────────────────────────
  .post(
    "/",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        workspaceId: z.string(),
        permissionKey: z.string().min(1),
        resourceType: z.string().optional(),
        resourceId: z.string().optional(),
        reason: z.string().max(500).optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId, permissionKey, resourceType, resourceId, reason } = c.req.valid("json");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      // Deduplicate: block if identical PENDING request exists
      try {
        const existing = await databases.listDocuments<AccessRequest>(
          DATABASE_ID,
          ACCESS_REQUESTS_ID,
          [
            Query.equal("workspaceId", workspaceId),
            Query.equal("requesterId", profile.id),
            Query.equal("permissionKey", permissionKey),
            Query.equal("status", "PENDING"),
            Query.limit(1),
          ]
        );
        if (existing.total > 0) {
          return c.json({ error: "An identical pending request already exists", existing: existing.documents[0] }, 409);
        }
      } catch { /* table not migrated yet */ }

      // Don't allow requesting permissions you already have
      if (can(profile, permissionKey)) {
        return c.json({ error: "You already have this permission" }, 400);
      }

      const req = await databases.createDocument<AccessRequest>(
        DATABASE_ID,
        ACCESS_REQUESTS_ID,
        ID.unique(),
        {
          workspaceId,
          requesterId: profile.id,
          permissionKey,
          resourceType: resourceType || null,
          resourceId: resourceId || null,
          reason: reason || null,
          status: "PENDING",
        }
      );

      // Notify reviewers async (don't await)
      notifyReviewers(workspaceId, {
        id: req.$id || req.id,
        permissionKey,
        requesterName: user.name || user.email,
      });

      return c.json({ data: req }, 201);
    }
  )
  // ── LIST MY REQUESTS ─────────────────────────────────────────────────────
  .get(
    "/mine",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.valid("query");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      try {
        const requests = await databases.listDocuments<AccessRequest>(
          DATABASE_ID, ACCESS_REQUESTS_ID,
          [
            Query.equal("workspaceId", workspaceId),
            Query.equal("requesterId", profile.id),
            Query.orderDesc("created_at"),
          ]
        );
        return c.json({ data: requests });
      } catch {
        return c.json({ data: { documents: [], total: 0 } });
      }
    }
  )
  // ── LIST FOR REVIEW ───────────────────────────────────────────────────────
  .get(
    "/review",
    sessionMiddleware,
    zValidator("query", z.object({
      workspaceId: z.string(),
      status: z.enum(["PENDING","APPROVED","DENIED","CANCELLED","EXPIRED"]).optional(),
    })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId, status } = c.req.valid("query");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "requests:review")) {
        return c.json({ error: "Forbidden", requiredPermission: "requests:review", canRequest: true }, 403);
      }

      const filters = [
        Query.equal("workspaceId", workspaceId),
        Query.orderDesc("created_at"),
      ];
      if (status) filters.push(Query.equal("status", status));

      try {
        const { users } = await createAdminClient();
        const requests = await databases.listDocuments<AccessRequest>(DATABASE_ID, ACCESS_REQUESTS_ID, filters);

        // Populate requester names
        const populated = await Promise.all(
          requests.documents.map(async (r) => {
            try {
              const member = await databases.getDocument<Member>(DATABASE_ID, MEMBERS_ID, r.requesterId);
              const u = await users.get(member.userId);
              return { ...r, requesterName: u.name || u.email, requesterEmail: u.email };
            } catch { return r; }
          })
        );

        return c.json({ data: { documents: populated, total: requests.total } });
      } catch {
        return c.json({ data: { documents: [], total: 0 } });
      }
    }
  )
  // ── APPROVE ───────────────────────────────────────────────────────────────
  .post(
    "/:requestId/approve",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        workspaceId: z.string(),
        grantType: z.enum(["ONE_TIME","TIME_LIMITED","PERMANENT"]),
        expiresAt: z.string().datetime().optional(), // ISO8601 for TIME_LIMITED
        reviewNote: z.string().max(500).optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { requestId } = c.req.param();
      const { workspaceId, grantType, expiresAt, reviewNote } = c.req.valid("json");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "requests:review")) {
        return c.json({ error: "Forbidden", requiredPermission: "requests:review", canRequest: true }, 403);
      }

      const request = await databases.getDocument<AccessRequest>(DATABASE_ID, ACCESS_REQUESTS_ID, requestId);
      if (!request || request.workspaceId !== workspaceId) return c.json({ error: "Not found" }, 404);
      if (request.status !== "PENDING") return c.json({ error: "Request is not pending" }, 400);

      // Reviewer cannot grant permissions they don't hold themselves
      if (!can(profile, request.permissionKey)) {
        return c.json({
          error: `Cannot approve: you don't hold the '${request.permissionKey}' permission yourself`,
        }, 403);
      }

      // Update request status
      await databases.updateDocument(DATABASE_ID, ACCESS_REQUESTS_ID, requestId, {
        status: "APPROVED",
        reviewerId: profile.id,
        reviewNote: reviewNote || null,
        grantType,
        expiresAt: expiresAt || null,
      });

      // Create permission grant
      const usesRemaining = grantType === "ONE_TIME" ? 1 : null;
      const grant = await databases.createDocument<PermissionGrant>(
        DATABASE_ID, PERMISSION_GRANTS_ID, ID.unique(),
        {
          workspaceId,
          memberId: request.requesterId,
          permissionKey: request.permissionKey,
          resourceType: request.resourceType || null,
          resourceId: request.resourceId || null,
          grantType,
          usesRemaining,
          expiresAt: expiresAt || null,
          grantedBy: profile.id,
          requestId,
          revoked: false,
        }
      );

      // Audit log
      await logPermissionAudit(databases, {
        workspaceId,
        actorMemberId: profile.id,
        action: "ASSIGN",
        entityType: "PERMISSION",
        entityId: requestId,
        newValues: { permissionKey: request.permissionKey, grantType, memberId: request.requesterId },
      });

      // Notify requester
      const requesterMember = await databases.getDocument<Member>(DATABASE_ID, MEMBERS_ID, request.requesterId).catch(() => null);
      if (requesterMember) {
        await sendNotification({
          workspaceId,
          userId: requesterMember.userId,
          type: "request_approved",
          title: "Access request approved",
          body: `Your request for '${request.permissionKey}' was approved (${grantType.toLowerCase().replace("_", " ")}).`,
          entityType: "access_request",
          entityId: requestId,
          actionUrl: `/workspaces/${workspaceId}/settings/my-requests`,
        });
      }

      return c.json({ data: { request: { ...request, status: "APPROVED" }, grant } });
    }
  )
  // ── DENY ─────────────────────────────────────────────────────────────────
  .post(
    "/:requestId/deny",
    sessionMiddleware,
    zValidator("json", z.object({
      workspaceId: z.string(),
      reviewNote: z.string().max(500).optional(),
    })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { requestId } = c.req.param();
      const { workspaceId, reviewNote } = c.req.valid("json");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);
      if (!can(profile, "requests:review")) {
        return c.json({ error: "Forbidden", requiredPermission: "requests:review", canRequest: true }, 403);
      }

      const request = await databases.getDocument<AccessRequest>(DATABASE_ID, ACCESS_REQUESTS_ID, requestId);
      if (!request || request.workspaceId !== workspaceId) return c.json({ error: "Not found" }, 404);
      if (request.status !== "PENDING") return c.json({ error: "Request is not pending" }, 400);

      await databases.updateDocument(DATABASE_ID, ACCESS_REQUESTS_ID, requestId, {
        status: "DENIED",
        reviewerId: profile.id,
        reviewNote: reviewNote || null,
      });

      await logPermissionAudit(databases, {
        workspaceId,
        actorMemberId: profile.id,
        action: "DELETE",
        entityType: "PERMISSION",
        entityId: requestId,
        newValues: { status: "DENIED", permissionKey: request.permissionKey },
      });

      // Notify requester
      const requesterMember = await databases.getDocument<Member>(DATABASE_ID, MEMBERS_ID, request.requesterId).catch(() => null);
      if (requesterMember) {
        await sendNotification({
          workspaceId,
          userId: requesterMember.userId,
          type: "request_denied",
          title: "Access request denied",
          body: reviewNote ? `Reason: ${reviewNote}` : `Your request for '${request.permissionKey}' was denied.`,
          entityType: "access_request",
          entityId: requestId,
          actionUrl: `/workspaces/${workspaceId}/settings/my-requests`,
        });
      }

      return c.json({ data: { status: "DENIED" } });
    }
  )
  // ── CANCEL (requester) ───────────────────────────────────────────────────
  .post(
    "/:requestId/cancel",
    sessionMiddleware,
    zValidator("json", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { requestId } = c.req.param();
      const { workspaceId } = c.req.valid("json");

      const profile = await getMemberPermissionProfile(databases, workspaceId, user.$id);
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const request = await databases.getDocument<AccessRequest>(DATABASE_ID, ACCESS_REQUESTS_ID, requestId);
      if (!request || request.workspaceId !== workspaceId) return c.json({ error: "Not found" }, 404);
      if (request.requesterId !== profile.id) return c.json({ error: "Cannot cancel another member's request" }, 403);
      if (request.status !== "PENDING") return c.json({ error: "Request is not pending" }, 400);

      await databases.updateDocument(DATABASE_ID, ACCESS_REQUESTS_ID, requestId, { status: "CANCELLED" });
      return c.json({ data: { status: "CANCELLED" } });
    }
  );

export default app;
