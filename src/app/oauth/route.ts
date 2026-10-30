import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { AUTH_COOKIE } from "@/features/auth/constants";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");

  if (error || errorDescription) {
    const errorMsg = encodeURIComponent(errorDescription || error || "Authentication failed");
    return NextResponse.redirect(`${request.nextUrl.origin}/sign-in?error=${errorMsg}`);
  }

  if (!code) {
    return NextResponse.redirect(`${request.nextUrl.origin}/sign-in?error=${encodeURIComponent("Missing authorization code")}`);
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore in Route Handler
          }
        },
      },
    }
  );

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.session) {
    const errorMsg = encodeURIComponent(exchangeError?.message || "OAuth exchange failed");
    return NextResponse.redirect(`${request.nextUrl.origin}/sign-in?error=${errorMsg}`);
  }

  const sessionSecret = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  cookieStore.set(AUTH_COOKIE, sessionSecret, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.redirect(`${request.nextUrl.origin}/`);
}
