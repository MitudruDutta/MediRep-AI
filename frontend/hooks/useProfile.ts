import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/context/AuthContext";

export interface UserProfile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    email?: string;
}

export function useProfile() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function fetchProfile() {
            if (!user?.id) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const supabase = createClient();

                // Try to get profile from Supabase
                const { data, error: fetchError } = await supabase
                    .from("profiles")
                    .select("full_name, avatar_url, bio")
                    .eq("id", user.id)
                    .single();

                if (fetchError && fetchError.code !== "PGRST116") { // Ignore 'not found' error
                    console.error("Error fetching profile:", fetchError);
                }

                // Construct profile object with fallbacks to user metadata
                const userProfile: UserProfile = {
                    id: user.id,
                    email: user.email,
                    full_name: data?.full_name || user.user_metadata?.full_name || null,
                    avatar_url: data?.avatar_url || user.user_metadata?.avatar_url || null,
                    bio: data?.bio || null,
                };

                setProfile(userProfile);
            } catch (err) {
                console.error("Unexpected error in useProfile:", err);
                setError(err instanceof Error ? err : new Error("Unknown error"));
            } finally {
                setLoading(false);
            }
        }

        fetchProfile();
    }, [user]);

    return { profile, loading, error };
}
