import asyncio
import json
import logging
import re
from typing import List, Optional

import google.generativeai as genai

from config import GEMINI_API_KEY, GEMINI_MODEL, MAX_HISTORY_MESSAGES
from models import PatientContext, Message, Citation, DrugInfo
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Lazy initialization
_model = None
_configured = False


def _get_model():
    """Lazy initialization of Gemini model."""
    global _model, _configured
    
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")
    
    if not _configured:
        genai.configure(api_key=GEMINI_API_KEY)
        _configured = True
    
    if _model is None:
        _model = genai.GenerativeModel(GEMINI_MODEL)
    
    return _model


SYSTEM_PROMPT = """You are MediRep AI, a Digital Medical Representative assistant designed for healthcare professionals.

YOUR ROLE:
- Provide instant, accurate drug and medical information
- Help doctors quickly find drug details, interactions, dosages
- Cite official sources (FDA, package inserts, clinical guidelines)
- Support clinical decision-making with evidence-based information

GUIDELINES:
1. Be concise and professional - doctors are busy
2. Always cite your sources inline
3. Highlight critical warnings prominently with ⚠️
4. Include dosage information when relevant
5. Mention drug interactions proactively
6. For serious queries, recommend specialist consultation

RESPONSE FORMAT:
- Lead with the direct answer
- Use bullet points for clarity
- End with relevant sources/citations
- Include 📋 for official guidelines, ⚠️ for warnings, 💊 for dosage info

IMPORTANT DISCLAIMERS:
- This is clinical decision support, not a replacement for clinical judgment
- Always verify critical information with official sources
- Report any suspected adverse events to appropriate authorities"""


def format_patient_context(context: Optional[PatientContext]) -> str:
    """Format patient context for the prompt."""
    if not context:
        return ""
    
    parts = []
    if context.age:
        parts.append(f"Age: {context.age}")
    if context.weight:
        parts.append(f"Weight: {context.weight}kg")
    if context.conditions:
        parts.append(f"Conditions: {', '.join(context.conditions)}")
    if context.current_meds:
        parts.append(f"Current medications: {', '.join(context.current_meds)}")
    if context.allergies:
        parts.append(f"Allergies: {', '.join(context.allergies)}")
    
    if parts:
        return f"\n\n👤 Patient Context: {', '.join(parts)}"
    return ""


def extract_citations(response_text: str, drug_name: Optional[str] = None) -> List[Citation]:
    """Extract or generate citations from response."""
    citations = []
    
    # Look for URLs in the text
    url_pattern = r'https?://[^\s\)]+' 
    urls = re.findall(url_pattern, response_text)
    
    for url in urls[:3]:
        if "fda.gov" in url:
            citations.append(Citation(title="FDA Drug Information", url=url, source="FDA"))
        elif "nih.gov" in url or "ncbi" in url:
            citations.append(Citation(title="NIH/PubMed Research", url=url, source="NIH"))
        elif "drugs.com" in url:
            citations.append(Citation(title="Drugs.com Reference", url=url, source="Drugs.com"))
        else:
            citations.append(Citation(title="Reference", url=url, source="Web"))
    
    # Add standard FDA citation if we have a drug name but no citations found
    if drug_name and not citations:
        safe_name = drug_name.replace(" ", "+").lower()
        citations.append(Citation(
            title=f"FDA Label: {drug_name.title()}",
            url=f"https://labels.fda.gov/search?q={safe_name}",
            source="FDA"
        ))
        citations.append(Citation(
            title=f"DailyMed: {drug_name.title()}",
            url=f"https://dailymed.nlm.nih.gov/dailymed/search.cfm?query={safe_name}",
            source="NIH"
        ))
    
    return citations[:3]


def generate_suggestions(message: str, response_text: str) -> List[str]:
    """Generate follow-up suggestions based on context."""
    suggestions = []
    combined_text = (message + " " + response_text).lower()
    
    # Drug-specific suggestions
    drug_patterns = [
        r'\b(metformin|aspirin|warfarin|lisinopril|atorvastatin|omeprazole|ibuprofen)\b',
        r'\b(acetaminophen|amoxicillin|prednisone|gabapentin|losartan|amlodipine)\b',
        r'\b(sertraline|escitalopram|duloxetine|metoprolol|furosemide)\b'
    ]
    
    found_drugs = set()
    for pattern in drug_patterns:
        matches = re.findall(pattern, combined_text)
        found_drugs.update(matches)
    
    if found_drugs:
        drug = list(found_drugs)[0]
        suggestions = [
            f"What are drug interactions with {drug}?",
            f"Dosage adjustments for {drug} in renal impairment?",
            f"What are the contraindications for {drug}?"
        ]
    elif "interaction" in combined_text:
        suggestions = [
            "Check interactions for my patient's medications",
            "Which interactions are clinically significant?",
            "Safe alternatives for this combination?"
        ]
    elif "side effect" in combined_text or "adverse" in combined_text:
        suggestions = [
            "How to manage this side effect?",
            "When should I be concerned?",
            "Alternative medications with fewer side effects?"
        ]
    else:
        suggestions = [
            "Check drug interactions",
            "What are common side effects?",
            "Dosage recommendations"
        ]
    
    return suggestions[:3]


class IntentPlan(BaseModel):
    intent: str = Field(..., description="One of: INFO, SUBSTITUTE, INTERACTION, GENERAL")
    drug_names: List[str] = Field(default_factory=list, description="List of recognized drug names found in the text. e.g. ['Dolo 650', 'Metformin']")
    entities: List[str] = Field(default_factory=list, description="Other entities like symptoms or conditions.")



async def plan_intent(message: str, history: List[ChatMessage] = None) -> IntentPlan:
    """Analyze user message to determine intent and extract entities, considering history."""
    try:
        model = _get_model()
        
        # Format recent history for context (last 3 turns)
        history_context = ""
        if history:
            recent = history[-3:]
            for msg in recent:
                role = "User" if msg.role == "user" else "Assistant"
                history_context += f"{role}: {msg.content}\n"
        
        prompt = f"""
        Analyze the following medical query and extract the Intent and Entities.
        Use the conversation history to resolve references (e.g., "it", "that drug").
        
        HISTORY:
        {history_context}
        
        CURRENT QUERY: "{message}"
        
        Intents:
        - INFO: Asking for drug details, price, manufacturer, dosage, or general info about a specific drug.
        - SUBSTITUTE: Asking for cheaper alternatives, substitutes, or generic versions.
        - INTERACTION: Asking about drug-drug, drug-food, or drug-condition interactions.
        - GENERAL: General medical questions, guidelines, or greeting.
        
        Extract:
        - drug_names: Specific drug brand names or generics mentioned. If user says "it" or "the drug", look at HISTORY to identify the drug name.
        
        Return JSON only.
        """
        
        response = await asyncio.to_thread(
            lambda: model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.0
                )
            )
        )
        
        text = response.text.strip()
        # Clean potential markdown code blocks
        if text.startswith("```json"):
            text = text[7:-3]
        
        return IntentPlan.model_validate_json(text)
        
    except Exception as e:
        logger.error(f"Intent planning failed: {e}")
        # Fallback to general intent
        return IntentPlan(intent="GENERAL", drug_names=[])


async def generate_response(
    message: str,
    patient_context: Optional[PatientContext] = None,
    history: Optional[List[Message]] = None,
    drug_info: Optional[DrugInfo] = None,
    rag_context: Optional[str] = None
) -> dict:
    """Generate a response using Gemini with RAG context."""
    
    if history is None:
        history = []
    
    try:
        model = _get_model()
        
        # Format history for Gemini
        formatted_history = []
        for msg in history[-MAX_HISTORY_MESSAGES:]:
            role = "user" if msg.role == "user" else "model"
            formatted_history.append({
                "role": role,
                "parts": [msg.content]
            })
        
        # Build context
        context_parts = []
        
        # 1. Add RAG context (retrieved knowledge)
        if rag_context:
            context_parts.append(f"\n\n📚 Retrieved Knowledge Base Context:\n{rag_context}")
        
        # 2. Add patient context
        patient_str = format_patient_context(patient_context)
        if patient_str:
            context_parts.append(patient_str)
        
        # 3. Add official drug info from FDA
        drug_name_for_citation = None
        if drug_info:
            drug_name_for_citation = drug_info.name
            drug_context = f"\n\n📋 Official FDA Drug Information for {drug_info.name}:"
            if drug_info.generic_name:
                drug_context += f"\nGeneric: {drug_info.generic_name}"
            if drug_info.indications:
                drug_context += f"\n💊 Indications: {'; '.join(drug_info.indications[:3])}"
            if drug_info.dosage:
                drug_context += f"\n💊 Dosage: {'; '.join(drug_info.dosage[:2])}"
            if drug_info.warnings:
                drug_context += f"\n⚠️ Warnings: {'; '.join(drug_info.warnings[:3])}"
            if drug_info.contraindications:
                drug_context += f"\n🚫 Contraindications: {'; '.join(drug_info.contraindications[:3])}"
            if drug_info.side_effects:
                drug_context += f"\n⚡ Side Effects: {'; '.join(drug_info.side_effects[:5])}"
            if drug_info.interactions:
                drug_context += f"\n⚠️ Interactions: {'; '.join(drug_info.interactions[:3])}"
            context_parts.append(drug_context)
        
        # Start chat
        chat = model.start_chat(history=formatted_history)
        
        # Build user message with context
        user_message = message
        if context_parts:
            user_message = "".join(context_parts) + "\n\n👨‍⚕️ Doctor's Question: " + message
        
        # Send with system prompt
        response = await asyncio.wait_for(
            asyncio.to_thread(
                lambda: chat.send_message(f"{SYSTEM_PROMPT}\n\n{user_message}")
            ),
            timeout=30.0
        )
        
        response_text = (response.text or "").strip()
        
        if not response_text:
            response_text = "I apologize, but I couldn't generate a response. Please try rephrasing your question."
        
        # Extract citations and generate suggestions
        citations = extract_citations(response_text, drug_name_for_citation)
        suggestions = generate_suggestions(message, response_text)
        
        return {
            "response": response_text,
            "citations": citations,
            "suggestions": suggestions
        }
    
    except asyncio.TimeoutError:
        logger.error("Gemini API timeout")
        raise Exception("Request timed out. Please try again.") from None
    except Exception as e:
        logger.error(f"Gemini API error: {e}", exc_info=True)
        raise Exception("Failed to generate response") from e
