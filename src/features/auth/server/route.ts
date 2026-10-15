import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";

import { createAdminClient, getSupabaseClient, getSupabaseAdminClient, ID } from "@/lib/supabase";
import { sessionMiddleware } from "@/lib/session-middleware";

import { AUTH_COOKIE } from "../constants";
import { loginSchema, registerSchema, resetPasswordSchema, updatePasswordSchema } from "../schemas";

const app = new Hono()
  .get(
    "/current",
    sessionMiddleware,
    (c) => {
      const user = c.get("user");

      return c.json({ data: user });
    }
  )
  .post(
    "/login",
    zValidator("json", loginSchema),
    async (c) => {
      const { email, password } = c.req.valid("json");

      try {
        const { account } = await createAdminClient();
        const session = await account.createEmailPasswordSession(
          email,
          password,
        );

        setCookie(c, AUTH_COOKIE, session.secret, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 60 * 60 * 24 * 30,
        });

        return c.json({ success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Invalid credentials";
        return c.json({ error: message }, 401);
      }
    }
  )
  .post(
    "/register",
    zValidator("json", registerSchema),
    async (c) => {
      const { name, email, password } = c.req.valid("json");

      try {
        const { account } = await createAdminClient();
        await account.create(
          ID.unique(),
          email,
          password,
          name,
        );

        const session = await account.createEmailPasswordSession(
          email,
          password,
        );

        setCookie(c, AUTH_COOKIE, session.secret, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 60 * 60 * 24 * 30,
        });

        return c.json({ success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Registration failed";
        return c.json({ error: message }, 400);
      }
    }
  )
  .post("/logout", sessionMiddleware, async (c) => {
    const account = c.get("account");

    deleteCookie(c, AUTH_COOKIE);
    await account.deleteSession("current");

    return c.json({ success: true });
  })
  .post(
    "/reset-password",
    zValidator("json", resetPasswordSchema),
    async (c) => {
      const { email } = c.req.valid("json");
      const origin = c.req.header("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      try {
        const client = getSupabaseClient();
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/reset-password`,
        });

        if (error) {
          return c.json({ error: error.message }, 400);
        }

        return c.json({ success: true, message: "Password reset link sent to your email" });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to request password reset";
        return c.json({ error: message }, 500);
      }
    }
  )
  .post(
    "/update-password",
    sessionMiddleware,
    zValidator("json", updatePasswordSchema),
    async (c) => {
      const { password } = c.req.valid("json");
      const user = c.get("user");

      try {
        const adminClient = getSupabaseAdminClient();
        const { error } = await adminClient.auth.admin.updateUserById(user.$id || user.id, {
          password,
        });

        if (error) {
          return c.json({ error: error.message }, 400);
        }

        return c.json({ success: true, message: "Password updated successfully" });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to update password";
        return c.json({ error: message }, 500);
      }
    }
  );

export default app;
