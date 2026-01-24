from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional, List
import logging
import asyncio
import re
from datetime import datetime, timezone

from slowapi import Limiter
from slowapi.util import get_remote_address

from models import ChatRequest, ChatResponse
from services.gemini_service import generate_response, plan_intent
from services.drug_service import get_drug_info, find_cheaper_substitutes
from services.rag_service import rag_service
from services.interaction_service import interaction_service
from services.supabase_service import SupabaseService
from middleware.auth import get_current_user, get_optional_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Local limiter for chat endpoint (separate from global app limiter)
limiter = Limiter(key_func=get_remote_address)


async def _save_chat_history(user_id: str, message: str, response: str, patient_context=None):
    """Save chat history to Supabase in background."""
    try:
        client = SupabaseService.get_client()
        if not client:
            logger.warning("No Supabase client for chat history")
            return

        patient_ctx = patient_context.model_dump() if patient_context else None

        result = await asyncio.to_thread(
            lambda: client.rpc("insert_chat_history", {
                "p_user_id": user_id,
                "p_message": message,
                "p_response": response[:2000],
                "p_patient_context": patient_ctx,
                "p_citations": None  # Can fail if column missing, so handle gracefully or update RPC
            }).execute()
        )
        logger.info("Chat history saved for user %s...", user_id[:8])
    except Exception as e:
        logger.error("Chat history save failed: %s", e)


def _detect_substitute_intent(message: str) -> bool:
    """Detect if user is asking for alternatives/substitutes using keywords."""
    keywords = ['alternative', 'substitute', 'cheaper', 'generic', 'similar',
                'instead of', 'replace', 'other option', 'less expensive']
    msg_lower = message.lower()
    return any(kw in msg_lower for kw in keywords)


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("10/minute")
async def chat_endpoint(
    request: Request,  # Required for rate limiting
    chat_request: ChatRequest,
    user: dict = Depends(get_current_user)
):
    """
    Digital Medical Representative AI - Powered by Gemini with RAG
    
    Provides healthcare professionals with instant, accurate drug and 
    reimbursement information with citations from official sources.
    """
    try:
        # 1. Intent Planning & Entity Extraction (LLM Powered)
        plan = await plan_intent(chat_request.message, history=chat_request.history)
        logger.info("Intent Plan: %s, Drugs: %s", plan.intent, plan.drug_names)

        # Keyword-based intent override (fallback when LLM intent fails)
        is_substitute_query = _detect_substitute_intent(chat_request.message)
        if is_substitute_query and plan.intent == "GENERAL":
            plan.intent = "SUBSTITUTE"
            logger.info("Intent overridden to SUBSTITUTE based on keywords")

        context_data = {}
        msg_context = ""

        # Extract drug name from history if not in current message
        drug_from_history = None
        if not plan.drug_names and chat_request.history:
            # Look for drug names in recent history
            for hist_msg in reversed(chat_request.history[-4:]):
                if hist_msg.role == "assistant" and hist_msg.content:
                    # Simple extraction: look for capitalized words that might be drug names
                    potential = re.findall(r'\b([A-Z][a-z]+(?:\s+\d+)?)\b', hist_msg.content[:200])
                    stop_words = {'the', 'this', 'that', 'yes', 'would', 'important', 'source', 'fda'}
                    drugs = [p for p in potential if p.lower() not in stop_words and len(p) > 3]
                    if drugs:
                        drug_from_history = drugs[0]
                        plan.drug_names = [drug_from_history]
                        logger.info("Drug extracted from history: %s", drug_from_history)
                        break

        # 2. Execution based on Intent
        if plan.intent == "SUBSTITUTE":
            # Find cheaper alternatives
            drug_name = plan.drug_names[0] if plan.drug_names else drug_from_history
            if drug_name:
                subs = await find_cheaper_substitutes(drug_name)
                if subs:
                    context_data['substitutes'] = subs
                    msg_context += f"\n\n[Cheaper Alternatives for {drug_name} from Database]\n"
                    for s in subs[:5]:
                        price_info = f" - {s.price_raw}" if s.price_raw else ""
                        mfg_info = f" by {s.manufacturer}" if s.manufacturer else ""
                        msg_context += f"- {s.name}{price_info}{mfg_info}\n"
                else:
                    msg_context += f"\n\n[No substitutes found in database for {drug_name}]\n[INSTRUCTION: Use your medical knowledge to suggest generic alternatives or similar medications for {drug_name}. Include approximate price comparisons if known.]"

        elif plan.intent == "INFO" or plan.intent == "GENERAL":
            # Fetch drug info if any drug names present
            if plan.drug_names:
                for drug in plan.drug_names[:1]:
                    info = await get_drug_info(drug)
                    if info:
                        context_data['drug_info'] = info
                        msg_context += f"\n\n[Database Info for {info.name}]\n"
                        if info.price_raw:
                            msg_context += f"Price: {info.price_raw}\n"
                        if info.manufacturer:
                            msg_context += f"Manufacturer: {info.manufacturer}\n"
                        if info.substitutes:
                            msg_context += f"Substitutes: {', '.join(info.substitutes[:3])}\n"

        elif plan.intent == "INTERACTION":
            # Check drug interactions if multiple drugs mentioned
            if len(plan.drug_names) >= 2:
                interactions = await interaction_service.check(plan.drug_names)
                if interactions:
                    msg_context += "\n\n[Drug Interactions Found]\n"
                    for inter in interactions[:3]:
                        msg_context += f"- {inter.drug1} + {inter.drug2}: {inter.severity} - {inter.description}\n"

        # 3. RAG Search using Qdrant + Turso (Hybrid: drug_embeddings + medical_qa)
        rag_content = None

        # Heuristic: Skip RAG for short, conversational replies
        is_conversational = len(chat_request.message.strip()) < 5 or chat_request.message.lower().strip() in {
            'yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'no', 'nope', 'thanks', 'thank you'
        }

        if not is_conversational:
            try:
                # Determine intent for hybrid weighting
                # Symptom keywords boost medical_qa results
                symptom_keywords = {'symptom', 'symptoms', 'feel', 'feeling', 'pain', 'ache',
                                   'diagnosis', 'diagnose', 'disease', 'condition', 'treatment'}
                query_lower = chat_request.message.lower()
                effective_intent = plan.intent

                if any(kw in query_lower for kw in symptom_keywords):
                    effective_intent = "SYMPTOM"

                # Hybrid search: drug_embeddings + medical_qa with intent-based weighting
                rag_content = await rag_service.search_hybrid(
                    query=chat_request.message,
                    intent=effective_intent,
                    top_k=5
                )
                logger.info("Hybrid RAG context found: %s (intent: %s)", bool(rag_content), effective_intent)

                # Fallback: If no hybrid matches, try direct text search in Turso
                if not rag_content and (plan.intent == "GENERAL" or not plan.drug_names):
                    desc_results = await rag_service.search_by_description(chat_request.message, limit=3)
                    if desc_results:
                        rag_content = desc_results

            except Exception as e:
                logger.warning("RAG search failed: %s", e)

        # 4. Generate Response
        gemini_result = await generate_response(
            message=chat_request.message + msg_context, # Inject structured data
            patient_context=chat_request.patient_context,
            history=chat_request.history,
            drug_info=context_data.get('drug_info'), # Still pass object for formatting if needed
            rag_context=rag_content
        )

        response_text = gemini_result.get("response", "")
        citations = gemini_result.get("citations", [])
        suggestions = gemini_result.get("suggestions", [])

        # 5. Save to chat history (non-blocking, don't fail the request if this fails)
        user_id = None
        if hasattr(user, 'id'):
            user_id = user.id
        elif isinstance(user, dict):
            user_id = user.get('id')
        
        if user_id:
            # Run in background - don't block the response
            asyncio.create_task(_save_chat_history(
                user_id=str(user_id),
                message=chat_request.message,
                response=response_text,
                patient_context=chat_request.patient_context
            ))

        return ChatResponse(
            response=response_text,
            citations=citations,
            suggestions=suggestions
        )

    except Exception as e:
        logger.exception("Chat error")
        raise HTTPException(
            status_code=500, 
            detail="Internal server error. Please try again."
        )
