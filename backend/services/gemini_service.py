import asyncio
import json
import logging
import re
import threading
from typing import List, Optional

import google.generativeai as genai
import httpx

from config import GEMINI_API_KEY, GEMINI_MODEL, MAX_HISTORY_MESSAGES, GROQ_API_KEY, GROQ_MODEL
from models import PatientContext, Message, Citation, DrugInfo, ChatMessage
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Groq API configuration
GROQ_API_BASE = "https://api.groq.com/openai/v1"

# Thread-safe lazy initialization
_model = None
_configured = False
_model_lock = threading.Lock()


def _get_model():
    """Lazy initialization of Gemini model (thread-safe)."""
    global _model, _configured

    if _model is not None:
        return _model

    with _model_lock:
        if _model is not None:
            return _model

        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not configured")

        if not _configured:
            genai.configure(api_key=GEMINI_API_KEY)
            _configured = True

        _model = genai.GenerativeModel(GEMINI_MODEL)

    return _model


SYSTEM_PROMPT = """You are MediRep AI, a conversational medical assistant for healthcare professionals in India.

OPERATING MODES:

MODE 1: GENERAL INQUIRY (No [Patient Context])
- Provide standard medical information for healthcare professionals.
- Focus on efficacy, mechanism of action, and standard dosing.

MODE 2: PATIENT SPECIFIC ([Patient Context] present)
- PERSONALIZE every answer to the patient's Age, Conditions, Allergies.
- Cross-check drug recommendations against patient profile.
- Explicitly mention compatibility or risks.

KNOWLEDGE SOURCES (You may receive one or more):

[Drug Database] - Indian drug data from our 250k+ database
- Contains: drug name, generic name, price, manufacturer, therapeutic class.
- Use for pricing, brand availability, and Indian market info.
- Cite as (Source: Database).

[Medical Knowledge (NIH)] - Authoritative Q&A from NIH/MedQuAD
- Contains: medical questions and expert answers from NIH sources.
- Use for symptoms, diagnoses, conditions, treatment guidelines.
- Highly reliable clinical information. Cite as (Source: NIH).

[Database Info for X] - Specific drug lookup result
- Detailed info for a specific drug query.
- If incomplete (missing indications/side effects), supplement with your medical knowledge.

RESPONSE RULES:
1. ANSWER ONLY what was asked - be direct and concise.
2. If database info is incomplete, USE YOUR MEDICAL KNOWLEDGE to fill gaps.
3. For symptom queries: explain causes, when to seek care, management.
4. For drug queries: include dosage, side effects, interactions if relevant.
5. Cite sources: (Source: Database), (Source: NIH), or (Source: Medical Knowledge).
6. Prefix critical warnings with "Important:".
7. For simple replies (yes, thanks), use chat history, ignore keyword-matched context.

CONVERSATION STYLE:
- Natural, professional, not robotic.
- Simple language healthcare workers understand.
- End with ONE relevant follow-up question.
- Plain text only, no markdown, no bullet lists.
- Keep under 250 words unless detail requested.
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
                logger.error("Groq API error: %s - %s", response.status_code, response.text)
                raise Exception(f"Groq API error: {response.status_code}")

            data = response.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error("Groq API call failed: %s", e)
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
    intent: str = Field(default="GENERAL", description="One of: INFO, SUBSTITUTE, INTERACTION, SYMPTOM, GENERAL")
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
        
        prompt = f"""Analyze the medical query and extract Intent and Entities.
Use conversation history to resolve references (e.g., "it", "that drug").

HISTORY:
{history_context}

CURRENT QUERY: "{message}"

Intents:
- INFO: Drug details, price, manufacturer, dosage, or general info about a specific drug.
- SUBSTITUTE: Cheaper alternatives, substitutes, or generic versions.
- INTERACTION: Drug-drug, drug-food, or drug-condition interactions.
- SYMPTOM: Questions about symptoms, conditions, diseases, diagnosis, or treatment guidelines (no specific drug mentioned).
- GENERAL: Greetings, thanks, or unclear queries.

Extract:
- intent: One of INFO, SUBSTITUTE, INTERACTION, SYMPTOM, GENERAL
- drug_names: Specific drug brand names or generics. Resolve "it"/"the drug" from HISTORY.
- entities: Symptoms, conditions, or body parts mentioned.

Return JSON only."""
        
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
        logger.error("Intent planning failed: %s", e)
        # Fallback to general intent
        return IntentPlan(intent="GENERAL", drug_names=[])


async def generate_response(
    message: str,
    patient_context: Optional[PatientContext] = None,
    history: Optional[List[Message]] = None,
    drug_info: Optional[DrugInfo] = None,
    rag_context: Optional[str] = None,
    images: Optional[List[str]] = None
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
        user_message_text = message
        if context_parts:
            user_message_text = "".join(context_parts) + "\n\n[Question] " + message
        
        # Prepare content parts (Text + Images)
        content_parts = [SYSTEM_PROMPT + "\n\n" + user_message_text]
        
        if images:
            import base64
            for img_str in images:
                # Handle data URL format (e.g., "data:image/jpeg;base64,.....")
                if "base64," in img_str:
                    img_str = img_str.split("base64,")[1]
                
                try:
                    image_data = base64.b64decode(img_str)
                    content_parts.append({
                        "mime_type": "image/jpeg", # Defaulting to jpeg, Gemini auto-detects usually or we can parse header
                        "data": image_data
                    })
                except Exception as e:
                    logger.error(f"Failed to decode image: {e}")

        # Send with system prompt (as text part of the first message)
        response = await asyncio.wait_for(
            asyncio.to_thread(
                lambda: chat.send_message(content_parts)
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
            logger.error("Groq fallback also failed: %s", groq_error)
            raise Exception("Request timed out. Please try again.") from None
    except Exception as e:
        logger.warning("Gemini API error: %s, attempting Groq fallback", e)
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


async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """Transcribe audio using Gemini."""
    try:
        model = _get_model()
        
        prompt = "Listen to this audio and provide a verbatim transcription of what is said. Return ONLY the text, no conversational filler or intro."
        
        content_parts = [
            prompt,
            {
                "mime_type": mime_type,
                "data": audio_bytes
            }
        ]
        
        response = await asyncio.to_thread(
            lambda: model.generate_content(content_parts)
        )
        
        return response.text.strip()
    except Exception as e:
        logger.error("Transcription failed: %s", e)
        raise Exception("Transcription failed") from e
