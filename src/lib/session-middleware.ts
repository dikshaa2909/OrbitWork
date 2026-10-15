import "server-only";

import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import { AUTH_COOKIE } from "@/features/auth/constants";
import {
  createDatabasesClient,
  createStorageClient,
  createUsersClient,
  getAuthenticatedUser,
  getSupabaseAdminClient,
  getSupabaseClient,
  parseAuthCookie,
  type Account,
  type AuthUser,
  type Databases,
  type Storage,
  type Users,
} from "./supabase";

type AdditionalContext = {
  Variables: {
    account: Account;
    databases: Databases;
    storage: Storage;
    users: Users;
    user: AuthUser;
  };
};

export const sessionMiddleware = createMiddleware<AdditionalContext>(
  async (c, next) => {
    const sessionCookie = getCookie(c, AUTH_COOKIE);

    if (!sessionCookie) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { accessToken, refreshToken } = parseAuthCookie(sessionCookie);
    const authResult = await getAuthenticatedUser(accessToken, refreshToken);

    if (!authResult || !authResult.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // If session was refreshed, use the new access token and update cookie
    let effectiveAccessToken = accessToken;
    if (authResult.session && typeof authResult.session === "object") {
      const session = authResult.session as { access_token?: string; refresh_token?: string };
      if (session.access_token) {
        effectiveAccessToken = session.access_token;
        // Update the cookie with refreshed tokens
        const newCookieValue = JSON.stringify({
          accessToken: session.access_token,
          refreshToken: session.refresh_token || refreshToken,
        });
        setCookie(c, AUTH_COOKIE, newCookieValue, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }
    }

    const userClient = getSupabaseClient(effectiveAccessToken);
    const adminClient = getSupabaseAdminClient();
    const databases = createDatabasesClient(userClient);
    const storage = createStorageClient(userClient);
    const users = createUsersClient(adminClient);

    const account: Account = {
      async get() {
        return authResult.user;
      },
      async deleteSession() {
        // Handled on logout
      },
    };

    c.set("account", account);
    c.set("databases", databases);
    c.set("storage", storage);
    c.set("users", users);
    c.set("user", authResult.user);

    await next();
  },
);
