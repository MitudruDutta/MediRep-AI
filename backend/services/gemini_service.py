import asyncio
import json
import logging
import re
from typing import List, Optional

import google.generativeai as genai
import httpx

from config import GEMINI_API_KEY, GEMINI_MODEL, MAX_HISTORY_MESSAGES, GROQ_API_KEY, GROQ_MODEL
from models import PatientContext, Message, Citation, DrugInfo, ChatMessage
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Groq API configuration
GROQ_API_BASE = "https://api.groq.com/openai/v1"

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


SYSTEM_PROMPT = """You are MediRep AI, a conversational medical assistant for healthcare professionals.

You operate in two distinct modes:

MODE 1: GENERAL INQUIRY (No [Patient Context] tag provided)
- Provide standard medical information, guidelines, and drug data suitable for a general audience.
- Focus on general efficacy, mechanism of action, and standard dosing.

MODE 2: PATIENT SPECIFIC (When [Patient Context] tag is present)
- YOU MUST personalize every answer to the specific patient.
- Cross-check all drug recommendations against the patient's Age, Sex, Conditions, and Allergies.
- Explicitly explain compatibility (e.g., "This drug is safe for the patient's hypertension because...").
- Any follow-up questions must be relevant to the patient's specific context.

UNIVERSAL RULES (Apply to both modes):
1. **Hybrid Knowledge**: You will receive [Database Info]. 
   - If the database info is incomplete (e.g., missing indications), YOU MUST USE YOUR MEDICAL KNOWLEDGE to fill in the missing indications/uses based on the drug's generic composition.
   - If you don't know the drug at all, do not invent facts.
2. **RAG/Chat History**: If the user's input is a simple reply (e.g., "yes"), ignore any [Knowledge Base Context] that looks like a keyword match. Rely on the Conversation History.
3. **Safety**: Prefix critical warnings with "Important:".

CONVERSATION STYLE:
- Be conversational and natural.
- Answer ONLY what was asked.
- CITE SOURCES: (Source: Database) for DB facts, (Source: Medical Knowledge) for your reasoning.
- End with a relevant follow-up question.

FORMATTING:
- Plain text only (no markdown symbols).
- Concise paragraphs.
"""


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
        return f"\n\n[Patient Context] {', '.join(parts)}"
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
    """Generate conversational follow-up suggestions based on context."""
    combined_text = (message + " " + response_text).lower()

    # Extract drug name from response for personalized suggestions
    drug_pattern = r'\b([A-Z][a-z]+(?:\s+\d+)?)\b'
    potential_drugs = re.findall(drug_pattern, response_text)

    stop_words = {'the', 'this', 'that', 'with', 'from', 'have', 'been', 'will', 'should',
                  'could', 'would', 'may', 'can', 'are', 'for', 'and', 'but', 'not', 'yes',
                  'warning', 'caution', 'note', 'important', 'source', 'sources', 'clinical',
                  'patient', 'patients', 'doctor', 'medical', 'treatment', 'therapy', 'fda',
                  'label', 'guidelines', 'recommended', 'advise', 'consult'}

    found_drugs = [d for d in potential_drugs if d.lower() not in stop_words and len(d) > 3]
    drug_name = found_drugs[0] if found_drugs else None

    # Determine what was already discussed to suggest OTHER topics
    discussed_dosage = any(x in combined_text for x in ['dosage', 'dose', 'mg', 'daily'])
    discussed_side_effects = any(x in combined_text for x in ['side effect', 'adverse', 'reaction'])
    discussed_interactions = any(x in combined_text for x in ['interaction', 'concurrent', 'combine'])
    discussed_warnings = any(x in combined_text for x in ['warning', 'caution', 'contraindic'])
    discussed_uses = any(x in combined_text for x in ['used for', 'indication', 'treat', 'relieve'])

    suggestions = []

    # Suggest topics NOT yet discussed
    if drug_name:
        if not discussed_dosage:
            suggestions.append(f"What's the recommended dosage?")
        if not discussed_side_effects:
            suggestions.append(f"What are the side effects?")
        if not discussed_interactions:
            suggestions.append(f"Any drug interactions?")
        if not discussed_warnings:
            suggestions.append(f"Any important warnings?")
        if not discussed_uses and len(suggestions) < 3:
            suggestions.append(f"What is it used for?")
        if len(suggestions) < 3:
            suggestions.append(f"Are there cheaper alternatives?")
    else:
        suggestions = [
            "Tell me more",
            "What should I monitor?",
            "Any precautions?"
        ]

    return suggestions[:3]


async def _call_groq_api(
    messages: List[dict],
    system_prompt: str,
    temperature: float = 0.7
) -> str:
    """Call Groq API as fallback when Gemini fails."""
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not configured")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Prepare messages for OpenAI-compatible API
            api_messages = [{"role": "system", "content": system_prompt}]
            api_messages.extend(messages)

            response = await client.post(
                f"{GROQ_API_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": api_messages,
                    "temperature": temperature,
                    "max_tokens": 2000
                }
            )

            if response.status_code != 200:
                logger.error(f"Groq API error: {response.status_code} - {response.text}")
                raise Exception(f"Groq API error: {response.status_code}")

            data = response.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Groq API call failed: {e}")
        raise


async def _generate_response_with_groq(
    message: str,
    patient_context: Optional[PatientContext] = None,
    history: Optional[List[Message]] = None,
    drug_info: Optional[DrugInfo] = None,
    rag_context: Optional[str] = None
) -> dict:
    """Generate response using Groq API as fallback."""
    logger.info("Using Groq API as fallback for response generation")

    if history is None:
        history = []

    # Build context
    context_parts = []

    if rag_context:
        context_parts.append(f"\n\n[Knowledge Base Context]\n{rag_context}")

    patient_str = format_patient_context(patient_context)
    if patient_str:
        context_parts.append(patient_str)

    drug_name_for_citation = None
    if drug_info:
        drug_name_for_citation = drug_info.name
        drug_context = f"\n\n[Database Info for {drug_info.name}]"
        
        # Track what info is available vs missing
        has_indication = False
        has_side_effects = False
        
        if drug_info.generic_name:
            drug_context += f"\nGeneric: {drug_info.generic_name}"
        if drug_info.indications and any(drug_info.indications):
            drug_context += f"\nIndications: {'; '.join(drug_info.indications[:3])}"
            has_indication = True
        if drug_info.dosage:
            drug_context += f"\nDosage: {'; '.join(drug_info.dosage[:2])}"
        if drug_info.warnings:
            drug_context += f"\nWarnings: {'; '.join(drug_info.warnings[:3])}"
        if drug_info.contraindications:
            drug_context += f"\nContraindications: {'; '.join(drug_info.contraindications[:3])}"
        if drug_info.side_effects and any(drug_info.side_effects):
            drug_context += f"\nSide Effects: {'; '.join(drug_info.side_effects[:5])}"
            has_side_effects = True
        if drug_info.interactions:
            drug_context += f"\nInteractions: {'; '.join(drug_info.interactions[:3])}"
        if drug_info.price_raw:
            drug_context += f"\nPrice: {drug_info.price_raw}"
        if drug_info.manufacturer:
            drug_context += f"\nManufacturer: {drug_info.manufacturer}"
        
        # Add explicit instruction when key info is missing
        if not has_indication or not has_side_effects:
            drug_context += "\n\n[INSTRUCTION: Database has limited info. USE YOUR MEDICAL KNOWLEDGE to provide complete information about indications, uses, side effects, and mechanism of action.]"
        
        context_parts.append(drug_context)

    # Format history for Groq (OpenAI-compatible format)
    formatted_messages = []
    for msg in history[-MAX_HISTORY_MESSAGES:]:
        formatted_messages.append({
            "role": msg.role,
            "content": msg.content
        })

    # Build user message with context
    user_message = message
    if context_parts:
        user_message = "".join(context_parts) + "\n\n[Question] " + message

    formatted_messages.append({"role": "user", "content": user_message})

    response_text = await _call_groq_api(
        messages=formatted_messages,
        system_prompt=SYSTEM_PROMPT,
        temperature=0.7
    )

    response_text = response_text.strip()

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


class IntentPlan(BaseModel):
    intent: str = Field(default="GENERAL", description="One of: INFO, SUBSTITUTE, INTERACTION, GENERAL")
    drug_names: List[str] = Field(default_factory=list, description="List of recognized drug names found in the text. e.g. ['Dolo 650', 'Metformin']")
    entities: Optional[List[str]] = Field(default_factory=list, description="Other entities like symptoms or conditions.")



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
            context_parts.append(f"\n\n[Knowledge Base Context]\n{rag_context}")
        
        # 2. Add patient context
        patient_str = format_patient_context(patient_context)
        if patient_str:
            context_parts.append(patient_str)
        
        # 3. Add drug info from database with explicit instruction to supplement
        drug_name_for_citation = None
        if drug_info:
            drug_name_for_citation = drug_info.name
            drug_context = f"\n\n[Database Info for {drug_info.name}]"
            
            # Track what info is available vs missing
            has_indication = False
            has_side_effects = False
            
            if drug_info.generic_name:
                drug_context += f"\nGeneric: {drug_info.generic_name}"
            if drug_info.indications and any(drug_info.indications):
                drug_context += f"\nIndications: {'; '.join(drug_info.indications[:3])}"
                has_indication = True
            if drug_info.dosage:
                drug_context += f"\nDosage: {'; '.join(drug_info.dosage[:2])}"
            if drug_info.warnings:
                drug_context += f"\nWarnings: {'; '.join(drug_info.warnings[:3])}"
            if drug_info.contraindications:
                drug_context += f"\nContraindications: {'; '.join(drug_info.contraindications[:3])}"
            if drug_info.side_effects and any(drug_info.side_effects):
                drug_context += f"\nSide Effects: {'; '.join(drug_info.side_effects[:5])}"
                has_side_effects = True
            if drug_info.interactions:
                drug_context += f"\nInteractions: {'; '.join(drug_info.interactions[:3])}"
            if drug_info.price_raw:
                drug_context += f"\nPrice: {drug_info.price_raw}"
            if drug_info.manufacturer:
                drug_context += f"\nManufacturer: {drug_info.manufacturer}"
            
            # Add explicit instruction when key info is missing
            if not has_indication or not has_side_effects:
                drug_context += "\n\n[INSTRUCTION: Database has limited info. USE YOUR MEDICAL KNOWLEDGE to provide complete information about indications, uses, side effects, and mechanism of action.]"
            
            context_parts.append(drug_context)

        # Start chat
        chat = model.start_chat(history=formatted_history)

        # Build user message with context
        user_message = message
        if context_parts:
            user_message = "".join(context_parts) + "\n\n[Question] " + message
        
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
        logger.warning("Gemini API timeout, attempting Groq fallback")
        try:
            return await _generate_response_with_groq(
                message=message,
                patient_context=patient_context,
                history=history,
                drug_info=drug_info,
                rag_context=rag_context
            )
        except Exception as groq_error:
            logger.error(f"Groq fallback also failed: {groq_error}")
            raise Exception("Request timed out. Please try again.") from None
    except Exception as e:
        logger.warning(f"Gemini API error: {e}, attempting Groq fallback")
        try:
            return await _generate_response_with_groq(
                message=message,
                patient_context=patient_context,
                history=history,
                drug_info=drug_info,
                rag_context=rag_context
            )
        except Exception as groq_error:
            logger.error(f"Groq fallback also failed: {groq_error}", exc_info=True)
            raise Exception("Failed to generate response") from e
