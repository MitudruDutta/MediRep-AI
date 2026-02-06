export interface PatientContext {
  age: number;
  sex: "male" | "female" | "other";
  weight?: number;
  preExistingDiseases: string[];
  currentMeds: string[];
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

// Enhanced Drug Interaction Types (AUC-based Mathematics)
export interface DrugChemistry {
  name: string;
  formula: string;  // e.g., "C9H8O4"
  formula_display: string;  // Unicode subscript: "C₉H₈O₄"
  smiles: string;
  molecular_weight: number;
  metabolism: string;
}

export interface InteractionMathematics {
  auc_ratio_r: number;
  inhibitor_concentration_um: number;
  ki_value_um: number;
  formula: string;
  calculation: string;
  severity: "none" | "minor" | "moderate" | "major";
  mechanism: string;
  affected_enzyme: string;
}

export interface MetabolicPathway {
  victim_normal: string;
  victim_inhibited: string;
  result: string;
  affected_metabolite_name?: string;
  affected_metabolite_formula?: string;
  affected_metabolite_smiles?: string;
}

export interface ReactionImage {
  url: string;
  prompt: string;
  generated_at?: string;
}

export interface ClinicalImpact {
  description: string;
  recommendation: string;
  severity: string;
}

export interface EnhancedInteraction {
  victim_drug: DrugChemistry;
  perpetrator_drug: DrugChemistry;
  interaction_mathematics: InteractionMathematics;
  metabolic_pathway: MetabolicPathway;
  clinical_impact: ClinicalImpact;
  reaction_image?: ReactionImage;
}

export interface DrugInfo {
  name: string;
  generic_name?: string;
  manufacturer?: string;
  price_raw?: string;
  pack_size?: string;
  indications?: string[];
  dosage?: string[];
  warnings?: string[];
  contraindications?: string[];
  side_effects?: string[];
  interactions?: string[];
  substitutes?: string[];
  therapeutic_class?: string;
  action_class?: string;
  formula?: string;
  smiles?: string;
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
