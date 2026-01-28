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
    },

    async getMyConsultations(status?: string): Promise<PharmacistConsultation[]> {
        const headers = await this.getHeaders();
        const url = status
            ? `${API_URL}/api/pharmacist/consultations?status=${status}`
            : `${API_URL}/api/pharmacist/consultations`;

        const res = await fetch(url, { headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Failed to fetch consultations (${res.status})`);
        }
        return res.json();
    },

    async getConsultation(id: string): Promise<PharmacistConsultation> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/consultations/${id}`, { headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "Failed to load consultation");
        }
        return res.json();
    },

    async joinCall(id: string) {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/consultations/${id}/join`, {
            method: "POST",
            headers
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "Failed to join call");
        }
        return res.json();
    },

    async getMessages(id: string) {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/consultations/${id}/messages`, { headers });
        if (!res.ok) throw new Error("Failed to load messages");
        return res.json();
    },

    async sendMessage(id: string, content: string) {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/consultations/${id}/message`, {
            method: "POST",
            headers,
            body: JSON.stringify({ content })
        });
        if (!res.ok) throw new Error("Failed to send message");
        return res.json();
    },

    async completeConsultation(id: string, notes?: string) {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/consultations/${id}/complete`, {
            method: "POST",
            headers,
            body: JSON.stringify({ notes })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "Failed to complete consultation");
        }
        return res.json();
    },

    async cancelConsultation(id: string, reason?: string) {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_URL}/api/consultations/${id}/cancel`, {
            method: "POST",
            headers,
            body: JSON.stringify({ reason: reason || "Cancelled by pharmacist" })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "Failed to cancel consultation");
        }
        return res.json();
    }
};

export interface PharmacistConsultation {
    id: string;
    patient_id: string;
    patient_name?: string;
    patient_concern?: string;
    scheduled_at: string;
    status: "pending_payment" | "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled";
    amount: number;
    duration_minutes: number;
    agora_channel?: string;
    payment_status: string;
}
