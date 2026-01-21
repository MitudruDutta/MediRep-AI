from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
import logging
import re
import asyncio
from datetime import datetime, timezone

from models import ChatRequest, ChatResponse
from services.gemini_service import generate_response, plan_intent
from services.drug_service import get_drug_info, find_cheaper_substitutes, search_drug_descriptions
from services.rag_service import rag_service
from services.interaction_service import interaction_service
from services.supabase_service import SupabaseService
from dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    user: dict = Depends(get_current_user)
):
    """
    Digital Medical Representative AI - Powered by Gemini with RAG
    
    Provides healthcare professionals with instant, accurate drug and 
    reimbursement information with citations from official sources.
    """
    try:
        # 1. Intent Planning & Entity Extraction (LLM Powered)
        # Fix Context Amnesia: Pass history to the planner
        plan = await plan_intent(request.message, history=request.history)
        logger.info(f"Intent Plan: {plan.intent}, Entities: {plan.drug_names}")
        
        context_data = {}
        msg_context = ""

        # 2. Execution based on Intent
        if plan.intent == "INFO" or plan.intent == "GENERAL":
            # Attempt to fetch drug info if any drug names are present
            if plan.drug_names:
                for drug in plan.drug_names[:1]: # Focus on primary drug
                    info = await get_drug_info(drug)
                    if info:
                        context_data['drug_info'] = info
                        # Add structured info to message context for Gemini
                        msg_context += f"\n\n💊 Database Info for {info.name}:\n"
                        msg_context += f"Price: {info.price_raw}\n"
                        msg_context += f"Manufacturer: {info.manufacturer}\n"
                        if info.substitutes:
                            msg_context += f"Common Substitutes: {', '.join(info.substitutes[:3])}\n"

        elif plan.intent == "SUBSTITUTE":
            if plan.drug_names:
                drug_name = plan.drug_names[0]
                subs = await find_cheaper_substitutes(drug_name)
                if subs:
                    context_data['substitutes'] = subs
                    msg_context += f"\n\n💰 Found {len(subs)} cheaper substitutes for {drug_name}:\n"
                    for s in subs[:5]:
                        msg_context += f"- {s.name} ({s.price_raw}): {s.manufacturer}\n"
                else:
                    msg_context += f"\n\nℹ️ No cheaper substitutes found for {drug_name} in the database."

        elif plan.intent == "INTERACTION":
            # Just pass through to Gemini for now, or implement strict interaction service check
            # For now, Gemini handled interactions well with knowledge base, but we can verify against specific entities if needed.
            # Ideally we would call interaction_service.check(plan.drug_names)
            pass

        # 3. RAG Search (Always run for context, especially if direct DB lookup failed or intent is broad)
        rag_content = None
        if not context_data or plan.intent == "GENERAL" or plan.intent == "INTERACTION":
            try:
                rag_content = await rag_service.search_context(request.message, top_k=3)
                
                # BRIDGE RAG DISCONNECT: If intent is GENERAL and no precise drug found, search descriptions
                # This helps with symptom-based queries like "medicine for headache"
                if plan.intent == "GENERAL" and not plan.drug_names:
                     desc_results = await search_drug_descriptions(request.message, limit=3)
                     if desc_results:
                         if rag_content:
                             rag_content += f"\n\n{desc_results}"
                         else:
                             rag_content = desc_results
                             
            except Exception as e:
                logger.warning(f"RAG failed: {e}")

        # 4. Generate Response
        gemini_result = await generate_response(
            message=request.message + msg_context, # Inject structured data
            patient_context=request.patient_context,
            history=request.history,
            drug_info=context_data.get('drug_info'), # Still pass object for formatting if needed
            rag_context=rag_content
        )

        response_text = gemini_result.get("response", "")
        citations = gemini_result.get("citations", [])
        suggestions = gemini_result.get("suggestions", [])

        # 5. Save to chat history
        user_id = user.get("id")
        if user_id:
            try:
                client = SupabaseService.get_client()
                if client:
                    patient_ctx = request.patient_context.model_dump() if request.patient_context else None
                    await asyncio.to_thread(
                        lambda: client.table("chat_history").insert({
                            "user_id": user_id,
                            "message": request.message,
                            "response": response_text,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "patient_context": patient_ctx
                        }).execute()
                    )
            except Exception as e:
                logger.error(f"Failed to save history: {e}")

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
