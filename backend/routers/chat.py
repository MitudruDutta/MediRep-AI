from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional, List
import logging
import asyncio
import re
from datetime import datetime, timezone

from slowapi import Limiter
from slowapi.util import get_remote_address

from models import ChatRequest, ChatResponse, Message
from services.gemini_service import generate_response, plan_intent
from services.drug_service import get_drug_info, find_cheaper_substitutes
from services.rag_service import rag_service
from services.interaction_service import interaction_service
from services.supabase_service import SupabaseService
from services.context_service import (
    load_session_context,
    compress_and_update_context,
    get_or_create_session,
    save_message_to_session,
)
from services.web_search_service import search_medical, format_web_results_for_llm, WebSearchResult
from middleware.auth import get_current_user, get_optional_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Local limiter for chat endpoint (separate from global app limiter)
limiter = Limiter(key_func=get_remote_address)



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
    user: object = Depends(get_current_user)  # user is AuthUser object
):
    """
    Digital Medical Representative AI - Powered by Gemini with RAG
    
    Provides healthcare professionals with instant, accurate drug and
    reimbursement information with citations from official sources.
    
    Session-based: Conversations persist across requests.
    Context compression: Efficient memory without sending all messages.
    """
    # Get user ID and Token
    user_id = user.id
    auth_token = user.token
    
    # Debug: Log web search mode
    logger.info("Chat request received. web_search_mode=%s, message=%s", 
                chat_request.web_search_mode, chat_request.message[:50])
    
    try:
        # ============================================================
        # SESSION & CONTEXT LOADING (new - everything else unchanged)
        # ============================================================

        # Get or create session
        try:
            session = await get_or_create_session(user_id, auth_token, chat_request.session_id)
            session_id = session["id"]
            current_summary = session.get("context_summary")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception:
            raise HTTPException(status_code=503, detail="Session service unavailable")

        # Load compressed context + recent history
        context_data_loaded = await load_session_context(session_id, auth_token)

        # Build history for LLM: recent exchanges from DB
        # (replaces client-sent history with server-side history)
        history_for_llm = []

        # Add context summary as system context if exists
        if context_data_loaded["summary"]:
            # Inject summary as first assistant message for context
            history_for_llm.append(Message(
                role="assistant",
                content=f"[Previous conversation context: {context_data_loaded['summary']}]"
            ))

        # Add recent full exchanges
        for h in context_data_loaded["recent_history"]:
            history_for_llm.append(Message(role=h["role"], content=h["content"]))

        # ============================================================
        # EXISTING WORKFLOW (unchanged from here)
        # ============================================================

        # 1. Intent Planning & Entity Extraction (LLM Powered)
        plan = await plan_intent(chat_request.message, history=history_for_llm)
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
        if not plan.drug_names and history_for_llm:
            # Look for drug names in recent history
            for hist_msg in reversed(history_for_llm[-4:]):
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

        # ============================================================
        # WEB SEARCH (Explicit mode OR Fallback)
        # ============================================================
        web_results = []
        web_context = ""
        
        # Freshness keywords that suggest user wants live data
        freshness_keywords = {'latest', 'current', 'today', 'now', 'recent', 'price now', 'live'}
        wants_fresh_data = any(kw in chat_request.message.lower() for kw in freshness_keywords)
        
        # Trigger web search if:
        # 1. Explicit web_search_mode is enabled, OR
        # 2. No local data found AND user wants fresh info, OR
        # 3. No local data found AND it's not a simple conversational message
        needs_web_search = (
            chat_request.web_search_mode or
            (not rag_content and not context_data.get('drug_info') and wants_fresh_data) or
            (not rag_content and not context_data.get('drug_info') and not is_conversational and plan.intent != "SYMPTOM")
        )
        
        if needs_web_search:
            logger.info("WEB SEARCH TRIGGERED: explicit=%s, rag_content=%s, drug_info=%s, wants_fresh=%s",
                       chat_request.web_search_mode, bool(rag_content), bool(context_data.get('drug_info')), wants_fresh_data)
            try:
                web_results = await search_medical(chat_request.message, num_results=5)
                if web_results:
                    web_context = format_web_results_for_llm(web_results)
                    msg_context += "\n\n" + web_context
                    logger.info("Web search added %d results for: %s", len(web_results), chat_request.message[:50])
                else:
                    logger.warning("Web search returned 0 results")
            except Exception as e:
                logger.warning("Web search failed: %s", e)
        else:
            logger.info("WEB SEARCH SKIPPED: explicit=%s, rag_content=%s, drug_info=%s",
                       chat_request.web_search_mode, bool(rag_content), bool(context_data.get('drug_info')))

        # 4. Generate Response
        gemini_result = await generate_response(
            message=chat_request.message + msg_context,  # Inject structured data
            patient_context=chat_request.patient_context,
            history=history_for_llm,  # Use session history, not client history
            drug_info=context_data.get('drug_info'),
            rag_context=rag_content,
            images=chat_request.images,
            language=chat_request.language  # Multi-language support
        )

        response_text = gemini_result.get("response", "")
        citations = gemini_result.get("citations", [])
        suggestions = gemini_result.get("suggestions", [])

        # 5. Save to session & compress context (non-blocking background tasks)
        patient_ctx = chat_request.patient_context.model_dump() if chat_request.patient_context else None
        citations_data = [c.model_dump() for c in citations] if citations else None

        # Save message to session
        asyncio.create_task(save_message_to_session(
            user_id=user_id,
            session_id=session_id,
            message=chat_request.message,
            response=response_text,
            auth_token=auth_token,
            patient_context=patient_ctx,
            citations=citations_data,
        ))

        # Compress context for next message (runs in background)
        asyncio.create_task(compress_and_update_context(
            session_id=session_id,
            user_message=chat_request.message,
            assistant_response=response_text,
            auth_token=auth_token,
            current_summary=current_summary,
        ))

        # Convert web results to response model format
        web_sources_response = [
            {"title": r.title, "url": r.url, "snippet": r.snippet, "source": r.source}
            for r in web_results
        ] if web_results else []

        return ChatResponse(
            response=response_text,
            citations=citations,
            suggestions=suggestions,
            session_id=session_id,
            web_sources=web_sources_response,
        )

    except Exception as e:
        logger.exception("Chat error")
        raise HTTPException(
            status_code=500, 
            detail="Internal server error. Please try again."
        )
