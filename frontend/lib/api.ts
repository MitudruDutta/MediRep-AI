import { PatientContext, Message } from "@/types";
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Get authentication headers with the current user's access token
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  return headers;
}

/**
 * Handle API response errors consistently
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid - trigger re-auth
      const supabase = createClient();
      await supabase.auth.refreshSession();
      throw new Error("Session expired. Please try again.");
    }

    if (response.status === 403) {
      throw new Error("You don't have permission to access this resource.");
    }

    if (response.status === 429) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }

    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Request failed: ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Authenticated fetch wrapper
 */
async function authFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = await getAuthHeaders();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  return handleResponse<T>(response);
}

export async function sendMessage(
  message: string,
  patientContext?: PatientContext,
  history?: Message[],
) {
  return authFetch(`${API_URL}/api/chat`, {
    method: "POST",
    body: JSON.stringify({
      message,
      patient_context: patientContext,
      history: history?.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
}

export async function searchDrugs(query: string) {
  const encodedQuery = encodeURIComponent(query);
  return authFetch(`${API_URL}/api/drugs/search?q=${encodedQuery}`);
}

export async function getDrugInfo(drugName: string) {
  const encodedName = encodeURIComponent(drugName);
  return authFetch(`${API_URL}/api/drugs/${encodedName}`);
}

export async function checkInteractions(drugs: string[], patientContext?: any) {
  return authFetch(`${API_URL}/api/drugs/interactions`, {
    method: "POST",
    body: JSON.stringify({ drugs, patient_context: patientContext }),
  });
}

// === NEW: User Profile API ===
export async function getPatientContext() {
  return authFetch<any>(`${API_URL}/api/user/profile/context`);
}

export async function savePatientContext(context: any) {
  return authFetch(`${API_URL}/api/user/profile/context`, {
    method: "POST",
    body: JSON.stringify(context),
  });
}
// =============================

// === NEW: Saved Drugs API ===
export async function getSavedDrugs() {
  return authFetch<any[]>(`${API_URL}/api/drugs/saved`);
}

export async function saveDrug(drugName: string, notes?: string) {
  return authFetch(`${API_URL}/api/drugs/saved`, {
    method: "POST",
    body: JSON.stringify({ drug_name: drugName, notes }),
  });
}
// =============================

export async function identifyPill(imageFile: File) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const formData = new FormData();
  formData.append("image", imageFile);

  const headers: HeadersInit = {};
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${API_URL}/api/vision/identify-pill`, {
    method: "POST",
    headers,
    body: formData,
  });

  return handleResponse(response);
}

export async function getFDAAlerts(drugName: string) {
  const encodedName = encodeURIComponent(drugName);
  return authFetch(`${API_URL}/api/alerts/${encodedName}`);
}

/**
 * Check if the current user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return !!session;
}

/**
 * Get current user's access token
 */
export async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}
