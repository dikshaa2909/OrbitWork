"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseClient } from "./supabase";

export async function signUpWithGithub() {
  const supabase = getSupabaseClient();
  const origin = headers().get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${origin}/oauth`,
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message || "Failed to start GitHub OAuth");
  }

  return redirect(data.url);
}

export async function signUpWithGoogle() {
  const supabase = getSupabaseClient();
  const origin = headers().get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/oauth`,
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message || "Failed to start Google OAuth");
  }

  return redirect(data.url);
}
