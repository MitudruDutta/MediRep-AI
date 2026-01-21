import asyncio
import json
import logging
import re
from typing import List, Optional
from urllib.parse import quote_plus

import google.generativeai as genai

from config import GEMINI_API_KEY, GEMINI_MODEL, MAX_HISTORY_MESSAGES
from models import PatientContext, Message, Citation, DrugInfo

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


SYSTEM_PROMPT = """You are MediRep AI, a knowledgeable and helpful medical information assistant.

GUIDELINES:
1. Provide accurate, evidence-based medical information
2. Always recommend consulting healthcare professionals for personal medical decisions
3. Include relevant warnings and contraindications
4. Be clear about the limitations of AI-provided medical information
5. Use simple language while maintaining medical accuracy

RESPONSE FORMAT:
- Start with a clear, direct answer
- Include relevant details (dosage info, side effects, interactions)
- End with safety reminders when appropriate

IMPORTANT: Never diagnose conditions or prescribe treatments. Always defer to healthcare professionals."""


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
        return f"\n\nPatient Context: {', '.join(parts)}"
    return ""


def extract_citations(response_text: str) -> List[Citation]:
    """Extract citations from response text."""
    citations = []
    
    # Look for URLs in the text
    url_pattern = r'https?://[^\s\)]+'
    urls = re.findall(url_pattern, response_text)
    
    for url in urls[:3]:  # Limit to 3 citations
        if "fda.gov" in url:
            citations.append(Citation(title="FDA Drug Information", url=url, source="FDA"))
        elif "nih.gov" in url or "ncbi" in url:
            citations.append(Citation(title="NIH Research", url=url, source="NIH"))
        else:
            citations.append(Citation(title="Reference", url=url, source="Web"))
    
    # Return empty list if no real citations found - don't fabricate
    return citations


def generate_suggestions(message: str, response_text: str) -> List[str]:
    """Generate follow-up suggestions based on message and response."""
    suggestions = []
    
    # Extract drugs from both message and response
    combined_text = (message + " " + response_text).lower()
    
    # Common drug patterns
    drug_patterns = [
        r'\b(metformin|aspirin|warfarin|lisinopril|atorvastatin|omeprazole|ibuprofen)\b',
        r'\b(acetaminophen|amoxicillin|prednisone|gabapentin|losartan|amlodipine)\b'
    ]
    
    found_drugs = set()
    for pattern in drug_patterns:
        matches = re.findall(pattern, combined_text)
        found_drugs.update(matches)
    
    # Generate drug-specific suggestions
    for drug in list(found_drugs)[:2]:
        suggestions.append(f"What are the side effects of {drug}?")
        suggestions.append(f"Are there any drug interactions with {drug}?")
    
    # Generic suggestions if no drugs found
    if not suggestions:
        suggestions = [
            "What medications should I avoid mixing?",
            "How can I manage common side effects?",
            "When should I consult my doctor?"
        ]
    
    return suggestions[:3]


async def generate_response(
    message: str,
    patient_context: Optional[PatientContext] = None,
    history: Optional[List[Message]] = None,
    drug_info: Optional[DrugInfo] = None
) -> dict:
    """Generate a response using Gemini."""
    
    if history is None:
        history = []
    
    try:
        model = _get_model()
        
        # Format history for Gemini
        formatted_history = []
        for msg in history[-MAX_HISTORY_MESSAGES:]:
            # Map roles correctly
            if msg.role == "user":
                role = "user"
            elif msg.role == "assistant":
                role = "model"
            else:
                logger.warning(f"Unknown role: {msg.role}, defaulting to model")
                role = "model"
            
            formatted_history.append({
                "role": role,
                "parts": [msg.content]
            })
        
        # Build context
        context_parts = []
        
        # Add patient context
        patient_str = format_patient_context(patient_context)
        if patient_str:
            context_parts.append(patient_str)
        
        # Add official drug info if available
        if drug_info:
            drug_context = f"\n\nOfficial Drug Information for {drug_info.name}:"
            if drug_info.indications:
                drug_context += f"\nIndications: {'; '.join(drug_info.indications[:3])}"
            if drug_info.warnings:
                drug_context += f"\nWarnings: {'; '.join(drug_info.warnings[:3])}"
            if drug_info.side_effects:
                drug_context += f"\nSide Effects: {'; '.join(drug_info.side_effects[:5])}"
            context_parts.append(drug_context)
        
        # Start chat with history
        chat = model.start_chat(history=formatted_history)
        
        # Build the user message (system prompt separate)
        user_message = message
        if context_parts:
            user_message = "".join(context_parts) + "\n\nUser Question: " + message
        
        # Send message with timeout
        response = await asyncio.wait_for(
            asyncio.to_thread(
                lambda: chat.send_message(
                    f"{SYSTEM_PROMPT}\n\n{user_message}"
                )
            ),
            timeout=30.0
        )
        
        response_text = (response.text or "").strip()
        
        if not response_text:
            response_text = "I apologize, but I couldn't generate a response. Please try rephrasing your question."
        
        # Extract citations and generate suggestions
        citations = extract_citations(response_text)
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
