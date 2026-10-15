import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { sessionMiddleware } from "@/lib/session-middleware";
import { Query } from "@/lib/supabase";
import { DATABASE_ID, NOTIFICATIONS_ID } from "@/config";
import type { Notification } from "@/features/access-requests/types";

const app = new Hono()
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({
      workspaceId: z.string(),
      read: z.enum(["true","false"]).optional(),
    })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId, read } = c.req.valid("query");

      const filters = [
        Query.equal("workspaceId", workspaceId),
        Query.equal("userId", user.$id),
        Query.orderDesc("created_at"),
      ];
      if (read === "false") filters.push(Query.equal("read", false));
      if (read === "true")  filters.push(Query.equal("read", true));

      try {
        const notifications = await databases.listDocuments<Notification>(
          DATABASE_ID, NOTIFICATIONS_ID, filters
        );
        return c.json({ data: notifications });
      } catch {
        return c.json({ data: { documents: [], total: 0 } });
      }
    }
  )
  .patch(
    "/:notificationId/read",
    sessionMiddleware,
    async (c) => {
      const databases = c.get("databases");
      const { notificationId } = c.req.param();

      try {
        await databases.updateDocument(DATABASE_ID, NOTIFICATIONS_ID, notificationId, { read: true });
        return c.json({ data: { id: notificationId, read: true } });
      } catch {
        return c.json({ error: "Not found" }, 404);
      }
    }
  )
  .post(
    "/read-all",
    sessionMiddleware,
    zValidator("json", z.object({ workspaceId: z.string() })),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.valid("json");

      try {
        const unread = await databases.listDocuments<Notification>(
          DATABASE_ID, NOTIFICATIONS_ID,
          [Query.equal("workspaceId", workspaceId), Query.equal("userId", user.$id), Query.equal("read", false)]
        );
        for (const n of unread.documents) {
          const nId = n.id || (n as unknown as { $id?: string }).$id || "";
          if (nId) {
            await databases.updateDocument(DATABASE_ID, NOTIFICATIONS_ID, nId, { read: true });
          }
        }
        return c.json({ data: { marked: unread.total } });
      } catch {
        return c.json({ data: { marked: 0 } });
      }
    }
  );

export default app;
