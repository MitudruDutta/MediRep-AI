import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              console.log(`[Supabase] Setting cookie: ${name}`);
              cookieStore.set(name, value, options)
            })
          } catch (error) {
            // Log the error for debugging
            console.error('[Supabase] Error setting cookies:', error);
          }
        },
      },
    }
  )
}
