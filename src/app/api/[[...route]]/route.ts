import { Hono } from "hono";
import { handle } from "hono/vercel";

import auth from "@/features/auth/server/route";
import members from "@/features/members/server/route";
import workspaces from "@/features/workspaces/server/route";
import projects from "@/features/projects/server/route";
import tasks from "@/features/tasks/server/route";
import sprints from "@/features/sprints/server/route";
import roles from "@/features/roles/server/route";
import teams from "@/features/teams/server/route";
import accessRequests from "@/features/access-requests/server/route";
import inviteLinks from "@/features/invite-links/server/route";
import notifications from "@/features/notifications/server/route";

const app = new Hono().basePath("/api");

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const routes = app
  .route("/auth", auth)
  .route("/members", members)
  .route("/workspaces", workspaces)
  .route("/projects", projects)
  .route("/tasks", tasks)
  .route("/sprints", sprints)
  .route("/roles", roles)
  .route("/teams", teams)
  .route("/access-requests", accessRequests)
  .route("/invite-links", inviteLinks)
  .route("/notifications", notifications);

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);

export type AppType = typeof routes;

