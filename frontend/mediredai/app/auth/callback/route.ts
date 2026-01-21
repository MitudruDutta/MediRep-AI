import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  console.log("Callback received with code:", code);

  // Handle direct login (password-based)
  if (code === "direct") {
    console.log("Direct login, redirecting to dashboard");
    return NextResponse.redirect(`${origin}/dashboard`, {
      status: 303,
    });
  }

  // Handle OAuth code exchange
  if (code) {
    try {
      const cookieStore = await cookies();
      let response = NextResponse.next();
      
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) => {
                  // Set on both the cookie store and the response
                  cookieStore.set(name, value, {
                    ...options,
                    path: '/',
                    sameSite: 'lax',
                    secure: process.env.NODE_ENV === 'production',
                  });
                  response.cookies.set(name, value, {
                    ...options,
                    path: '/',
                    sameSite: 'lax',
                    secure: process.env.NODE_ENV === 'production',
                  });
                  console.log(`[Callback] Setting cookie: ${name} with maxAge:`, options?.maxAge);
                });
              } catch (error) {
                console.error('[Callback] Error setting cookies:', error);
              }
            },
          },
        }
      );

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("OAuth callback error:", error.message);
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error.message)}`, {
          status: 303,
        });
      }

      if (data.session) {
        console.log("Session created successfully for:", data.session.user.email);
        console.log("Access token:", data.session.access_token.substring(0, 20) + "...");
        console.log("Session expires at:", new Date(data.session.expires_at! * 1000).toISOString());
      }
      
      // Create redirect response with cookies
      const redirectResponse = NextResponse.redirect(`${origin}/dashboard`, {
        status: 303,
      });
      
      // Copy all cookies from response to redirectResponse
      response.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      
      return redirectResponse;
      
    } catch (error: any) {
      console.error("OAuth callback exception:", error);
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error.message || "Authentication failed")}`, {
        status: 303,
      });
    }
  }

  console.log("No code provided, redirecting to login");
  return NextResponse.redirect(`${origin}/auth/login`, {
    status: 303,
  });
}

