import useSWR, { mutate } from "swr";
import { SessionSummary } from "@/types";
import { getUserSessions } from "@/lib/api";

// Cache key for sessions
const SESSIONS_KEY = "user-sessions";

/**
 * Hook for fetching and caching chat sessions using SWR.
 * 
 * Features:
 * - Instant render from cache on subsequent visits
 * - Background revalidation for fresh data
 * - Optimistic updates when sessions change
 * - Automatic error handling and retry
 */
export function useSessions(limit: number = 50) {
    const { data, error, isLoading, isValidating, mutate: boundMutate } = useSWR<SessionSummary[]>(
        SESSIONS_KEY,
        () => getUserSessions(limit),
        {
            // Keep data fresh for 5 minutes before background revalidation
            refreshInterval: 0, // Manual refresh only
            revalidateIfStale: true,
            // Revalidate on mount to get fresh data in background
            revalidateOnMount: true,
            // Keep previous data while revalidating - this is the key for instant UI
            keepPreviousData: true,
        }
    );

    return {
        sessions: data || [],
        isLoading,
        isValidating, // True when revalidating in background
        error,
        refresh: boundMutate,
    };
}

/**
 * Invalidate session cache globally.
 * Call this after creating a new session or sending a message.
 */
export async function invalidateSessionsCache() {
    await mutate(SESSIONS_KEY);
}

/**
 * Optimistically update session cache.
 * Use this for instant UI updates before server confirms.
 */
export async function updateSessionsCache(
    updater: (current: SessionSummary[] | undefined) => SessionSummary[]
) {
    await mutate(SESSIONS_KEY, updater, { revalidate: true });
}
