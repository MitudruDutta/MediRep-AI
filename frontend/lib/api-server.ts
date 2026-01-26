import "server-only";

import { createClient } from "@/lib/supabase/server";
import { SessionSummary } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Server-side fetch utility for API calls.
 * Uses the user's session token from cookies for authentication.
 * 
 * SECURITY: This runs on the server only (`server-only` import ensures this).
 * The auth token is extracted from HttpOnly cookies, never exposed to client JS.
 */
async function serverFetch<T>(endpoint: string): Promise<T | null> {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
            console.log("[Server API] No session found, skipping prefetch");
            return null;
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
            },
            // Cache for 60 seconds on the server
            next: { revalidate: 60 },
        });

        if (!response.ok) {
            console.error(`[Server API] Error: ${response.status} ${response.statusText}`);
            return null;
        }

        return response.json();
    } catch (error) {
        console.error("[Server API] Fetch failed:", error);
        return null;
    }
}

/**
 * Fetch user's chat sessions on the server.
 * Used for prefetching in Server Components.
 */
export async function getSessionsServer(limit: number = 50): Promise<SessionSummary[]> {
    const sessions = await serverFetch<SessionSummary[]>(`/api/sessions?limit=${limit}&offset=0`);
    return sessions || [];
}
