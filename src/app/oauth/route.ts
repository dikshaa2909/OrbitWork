import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE } from "@/features/auth/constants";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return new NextResponse("Missing authorization code", { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return new NextResponse(error?.message || "OAuth exchange failed", { status: 400 });
  }

  const sessionSecret = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  cookies().set(AUTH_COOKIE, sessionSecret, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.redirect(`${request.nextUrl.origin}/`);
}
