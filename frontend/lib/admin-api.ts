import { createClient } from "@supabase/supabase-js";

// We need to use the backend API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Interface for Pharmacist Application
export interface PharmacistApplication {
    id: string;
    user_id: string;
    full_name: string;
    email?: string;
    phone: string;
    license_number: string;
    license_image_url: string;
    license_state?: string;
    license_expiry?: string;
    ai_confidence_score: number;
    ai_extracted_data?: any;
    verification_status: "pending" | "under_review" | "approved" | "rejected";
    created_at: string;
}

export interface AdminStats {
    total_users: number;
    total_pharmacists: number;
    pending_verifications: number;
    total_consultations: number;
    total_revenue: number;
}

/**
 * Admin API Client
 * Uses the user's session token to authenticate with the backend
 */
export const adminApi = {

    /**
     * Get authentication headers
     */
    async getHeaders() {
        // We need to get the session token from Supabase
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            throw new Error("Not authenticated");
        }

        return {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
        };
    },

    /**
     * Get system stats
     */
    async getStats(): Promise<AdminStats> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/admin/stats`, { headers });

        if (!res.ok) throw new Error("Failed to fetch stats");
        return res.json();
    },

    /**
     * Get pending pharmacist applications
     */
    async getPendingPharmacists(): Promise<PharmacistApplication[]> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/admin/pharmacists/pending`, { headers });

        if (!res.ok) throw new Error("Failed to fetch pending applications");
        return res.json();
    },

    /**
     * Verify a pharmacist application (Approve/Reject)
     */
    async verifyPharmacist(
        pharmacistId: string,
        status: "approved" | "rejected",
        notes?: string
    ): Promise<any> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/admin/pharmacists/${pharmacistId}/verify`, {
            method: "POST",
            headers,
            body: JSON.stringify({ status, notes }),
        });

        if (!res.ok) throw new Error("Failed to verify pharmacist");
        return res.json();
    }
};
