import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("OAuth callback error:", error.message);
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error.message)}`);
      }

      if (!data.session) {
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent("No session created")}`);
      }
    } catch (error) {
      console.error("OAuth callback exception:", error);
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent("Authentication failed")}`);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
