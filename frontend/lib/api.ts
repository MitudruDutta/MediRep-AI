import { PatientContext, Message } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function sendMessage(
  message: string,
  patientContext?: PatientContext,
  history?: Message[]
) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      patient_context: patientContext,
      history: history?.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

export async function searchDrugs(query: string) {
  const response = await fetch(`${API_URL}/api/drugs/search?q=${encodeURIComponent(query)}`);
  
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

export async function getDrugInfo(drugName: string) {
  const response = await fetch(`${API_URL}/api/drugs/${encodeURIComponent(drugName)}`);
  
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

export async function checkInteractions(drugs: string[]) {
  const response = await fetch(`${API_URL}/api/drugs/interactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drugs }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

export async function identifyPill(imageFile: File) {
  const formData = new FormData();
  formData.append("image", imageFile);

  const response = await fetch(`${API_URL}/api/vision/identify-pill`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

export async function getFDAAlerts(drugName: string) {
  const response = await fetch(`${API_URL}/api/alerts/${encodeURIComponent(drugName)}`);
  
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}