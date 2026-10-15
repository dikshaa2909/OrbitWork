import { cookies } from "next/headers";

import { AUTH_COOKIE } from "./constants";
import { getAuthenticatedUser, parseAuthCookie } from "@/lib/supabase";

export const getCurrent = async () => {
  try {
    const sessionCookie = cookies().get(AUTH_COOKIE)?.value;
    if (!sessionCookie) {
      return null;
    }

    const { accessToken, refreshToken } = parseAuthCookie(sessionCookie);
    const authResult = await getAuthenticatedUser(accessToken, refreshToken);

    return authResult?.user ?? null;
  } catch {
    return null;
  }
};
