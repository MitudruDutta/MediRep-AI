import { createClient } from "@supabase/supabase-js";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PharmacistStats {
    total_earnings: number;
    pending_payout: number;
    completed_consultations: number;
    upcoming_consultations: number;
    rating_avg: number;
    rating_count: number;
}

export interface ScheduleSlot {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
}

export const pharmacistApi = {
    async getHeaders() {
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

    async getDashboardStats(): Promise<PharmacistStats> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/pharmacist/dashboard`, { headers });
        if (!res.ok) throw new Error("Failed to fetch dashboard stats");
        return res.json();
    },

    async toggleAvailability(isAvailable: boolean): Promise<{ is_available: boolean }> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/pharmacist/availability?is_available=${isAvailable}`, {
            method: "PUT",
            headers
        });
        if (!res.ok) throw new Error("Failed to update availability");
        return res.json();
    },

    async getSchedule(): Promise<ScheduleSlot[]> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/pharmacist/schedule`, { headers });
        if (!res.ok) throw new Error("Failed to fetch schedule");
        return res.json();
    },

    async setSchedule(slots: ScheduleSlot[]): Promise<ScheduleSlot[]> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/pharmacist/schedule`, {
            method: "POST",
            headers,
            body: JSON.stringify(slots)
        });
        if (!res.ok) throw new Error("Failed to update schedule");
        return res.json();
    }
};
