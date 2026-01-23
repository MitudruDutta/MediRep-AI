from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
from datetime import datetime


class PatientContext(BaseModel):
    age: Optional[int] = Field(None, ge=0, le=150)
    weight: Optional[float] = Field(None, ge=0, le=1000)
    conditions: List[str] = Field(default_factory=list)
    current_meds: List[str] = Field(default_factory=list, alias="currentMeds")
    allergies: List[str] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


# Alias for compatibility
ChatMessage = Message


class Citation(BaseModel):
    title: str
    url: str
    source: str


class ChatRequest(BaseModel):
    message: str
    patient_context: Optional[PatientContext] = None
    history: List[Message] = Field(default_factory=list)


class ChatResponse(BaseModel):
    response: str
    citations: List[Citation] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)


class DrugInfo(BaseModel):
    name: str
    generic_name: Optional[str] = None
    manufacturer: Optional[str] = None
    indications: List[str] = Field(default_factory=list)
    dosage: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    contraindications: List[str] = Field(default_factory=list)
    side_effects: List[str] = Field(default_factory=list)
    interactions: List[str] = Field(default_factory=list)
    
    # India-specific fields
    indian_brands: List[str] = Field(default_factory=list)
    substitutes: List[str] = Field(default_factory=list)
    mrp_range: Optional[str] = None
    price_raw: Optional[str] = None
    price: Optional[float] = None
    jan_aushadhi_price: Optional[str] = None
    pack_size: Optional[str] = None
    nlem_status: bool = False
    dpco_controlled: bool = False
    schedule: Optional[str] = None
    therapeutic_class: Optional[str] = None
    action_class: Optional[str] = None


class DrugSearchResult(BaseModel):
    name: str
    generic_name: Optional[str] = None
    manufacturer: Optional[str] = None


class DrugInteraction(BaseModel):
    drug1: str
    drug2: str
    severity: Literal["minor", "moderate", "major"]
    description: str
    recommendation: str


class InteractionRequest(BaseModel):
    drugs: List[str] = Field(..., min_length=1, max_length=10)
    patient_context: Optional[PatientContext] = None


class InteractionResponse(BaseModel):
    interactions: List[DrugInteraction]


class PillIdentification(BaseModel):
    name: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    description: str
    color: Optional[str] = None
    shape: Optional[str] = None
    imprint: Optional[str] = None


class FDAAlert(BaseModel):
    id: str
    severity: Literal["info", "warning", "recall"]
    title: str
    description: str
    date: Optional[datetime] = None
    lot_numbers: List[str] = Field(default_factory=list)

    @field_validator('date', mode='before')
    @classmethod
    def parse_date(cls, v):
        if v is None:
            return None
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except ValueError:
                return None
        return None


class FDAAlertResponse(BaseModel):
    drug_name: str
    alerts: List[FDAAlert] = Field(default_factory=list)


class SavedDrug(BaseModel):
    drug_name: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
