export interface PatientContext {
  age: number;
  sex: "male" | "female" | "other";
  weight?: number;
  conditions: string[];
  currentMeds: string[];
  allergies: string[];
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: string;
}

export interface Citation {
  source: string;
  title: string;
  url: string;
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "major" | "moderate" | "minor";
  description: string;
  recommendation?: string;
}

export interface DrugInfo {
  name: string;
  generic_name?: string;
  manufacturer?: string;
  indications?: string[];
  dosage?: string[];
  warnings?: string[];
  contraindications?: string[];
  side_effects?: string[];
  interactions?: string[];
}

export interface PillIdentification {
  name: string;
  confidence: number;
  description: string;
  color?: string;
  shape?: string;
  imprint?: string;
}

export interface FDAAlert {
  id: string;
  severity: "info" | "warning" | "recall";
  title: string;
  description: string;
  date: string | null;
  lot_numbers: string[];
}

export interface FDAAlertResponse {
  drug_name: string;
  alerts: FDAAlert[];
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface ChatResponse {
  response: string;
  citations?: Citation[];
  suggestions?: string[];
  session_id: string;
  web_sources?: WebSearchResult[];
}

export interface SessionSummary {
  id: string;
  title: string;
  message_count: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}
