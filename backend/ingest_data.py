"""
Ingest comprehensive medical data into the RAG system.
Run this script to populate the vector database with clinical knowledge.

Usage: python ingest_data.py
"""
import asyncio
import logging
import textwrap

from dotenv import load_dotenv

load_dotenv()

from services.rag_service import rag_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Comprehensive medical knowledge base for Digital Medical Representative
SAMPLE_DOCUMENTS = [
    # Drug Interactions Guide
    {
        "content": textwrap.dedent("""
            HIGH-PRIORITY DRUG INTERACTIONS FOR CLINICAL PRACTICE:
            
            1. WARFARIN INTERACTIONS (Major Risk):
            - Aspirin/NSAIDs: Increased bleeding risk. Avoid or monitor INR closely.
            - Antibiotics (metronidazole, fluconazole): Increases warfarin effect.
            - Vitamin K foods: Decreases warfarin effect. Maintain consistent intake.
            - CYP2C9 inhibitors: Increases warfarin levels. Dose reduction needed.
            
            2. STATINS + INTERACTING DRUGS:
            - Gemfibrozil + statins: Rhabdomyolysis risk. Use fenofibrate instead.
            - Grapefruit juice: Increases statin levels (atorvastatin, simvastatin).
            - Clarithromycin/erythromycin: Increases statin toxicity.
            
            3. ACE INHIBITORS/ARBs:
            - Potassium supplements: Hyperkalemia risk. Monitor K+ levels.
            - NSAIDs: Reduced antihypertensive effect, acute kidney injury risk.
            - Lithium: Increased lithium levels. Monitor lithium closely.
            
            4. METFORMIN CONSIDERATIONS:
            - IV contrast: Hold 48h before/after to prevent lactic acidosis.
            - Alcohol: Increases lactic acidosis risk.
            - Renal impairment: Contraindicated if eGFR <30.
            
            5. OPIOID INTERACTIONS:
            - Benzodiazepines: Respiratory depression risk. FDA Black Box Warning.
            - MAOIs: Serotonin syndrome risk. 14-day washout required.
            - CYP3A4 inhibitors: Increases opioid effect.
        """).strip(),
        "source": "drug_interactions_clinical_guide"
    },
    
    # Diabetes Management
    {
        "content": textwrap.dedent("""
            DIABETES MELLITUS TREATMENT GUIDELINES:
            
            FIRST-LINE THERAPY:
            - Metformin: Start 500mg daily, titrate to 2000mg max.
            - Contraindications: eGFR <30, active liver disease.
            - Hold before contrast procedures.
            
            SECOND-LINE OPTIONS (add if HbA1c >7% on metformin):
            - SGLT2 inhibitors (empagliflozin, dapagliflozin): Cardiovascular benefit.
            - GLP-1 agonists (semaglutide, liraglutide): Weight loss benefit.
            - DPP-4 inhibitors (sitagliptin): Weight neutral.
            - Sulfonylureas (glipizide, glimepiride): Hypoglycemia risk.
            
            HbA1c TARGETS:
            - General: <7.0%
            - Elderly/frail: <8.0%
            - Limited life expectancy: Avoid hypoglycemia
            
            MONITORING:
            - HbA1c every 3 months until stable, then every 6 months.
            - Annual: Lipids, renal function, microalbumin, eye exam.
            
            SICK DAY RULES:
            - Continue metformin unless dehydrated/vomiting.
            - Increase glucose monitoring.
            - Seek care if BG >300 or ketones present.
        """).strip(),
        "source": "diabetes_treatment_guidelines"
    },
    
    # Common Medication Side Effects
    {
        "content": textwrap.dedent("""
            COMMON MEDICATION SIDE EFFECTS AND MANAGEMENT:
            
            STATINS (atorvastatin, rosuvastatin):
            - Myalgias (5-10%): Check CK if severe. Consider CoQ10.
            - Hepatotoxicity: Monitor LFTs at baseline.
            - New-onset diabetes: Monitor glucose in high-risk patients.
            
            ACE INHIBITORS (lisinopril, enalapril):
            - Dry cough (10%): Switch to ARB if intolerable.
            - Angioedema (rare): Contraindicate all ACE-I.
            - Hyperkalemia: Monitor K+ especially with renal impairment.
            
            METFORMIN:
            - GI upset (30%): Take with food, use XR formulation.
            - B12 deficiency: Check levels annually.
            - Lactic acidosis (rare): Avoid with renal impairment.
            
            SSRIs (sertraline, escitalopram):
            - Sexual dysfunction (30-40%): Consider bupropion switch.
            - Weight gain: More common with paroxetine.
            - Discontinuation syndrome: Taper slowly.
            
            BETA-BLOCKERS (metoprolol, carvedilol):
            - Fatigue, bradycardia: Dose-related.
            - Bronchospasm: Avoid in asthma.
            - Masking hypoglycemia: Caution in diabetes.
            
            OPIOIDS:
            - Constipation (90%+): Start bowel regimen prophylactically.
            - Nausea: Often resolves in 3-5 days.
            - Respiratory depression: Higher risk with benzos.
        """).strip(),
        "source": "medication_side_effects"
    },
    
    # Renal Dosing Adjustments
    {
        "content": textwrap.dedent("""
            RENAL DOSING ADJUSTMENTS (By eGFR):
            
            eGFR 30-60 mL/min:
            - Metformin: Max 1000mg/day
            - Gabapentin: Reduce by 50%
            - Allopurinol: Start 100mg, max 200mg
            - Enoxaparin: Standard dose, monitor anti-Xa
            
            eGFR 15-30 mL/min:
            - Metformin: AVOID
            - Gabapentin: 100-300mg daily
            - Allopurinol: Max 100mg
            - DOACs: Varies by agent, some contraindicated
            
            eGFR <15 mL/min (Dialysis):
            - Most drugs need adjustment
            - Avoid: Metformin, SGLT2i, NSAIDs long-term
            - Gabapentin: 100mg post-dialysis
            - Insulin: Often reduced needs
            
            NEPHROTOXIC DRUGS TO AVOID/MONITOR:
            - NSAIDs (except aspirin for CV)
            - Aminoglycosides
            - IV contrast (with precautions)
            - High-dose lithium
            - Amphotericin B
        """).strip(),
        "source": "renal_dosing_guide"
    },
    
    # Anticoagulation Guide  
    {
        "content": textwrap.dedent("""
            ANTICOAGULATION THERAPY GUIDE:
            
            WARFARIN:
            - INR target: 2.0-3.0 (most indications), 2.5-3.5 (mechanical valve)
            - Initial dosing: 5mg daily (reduce in elderly, low weight)
            - Drug interactions: Many! Check all new medications.
            - Reversal: Vitamin K, FFP, PCC based on urgency.
            
            DOACS (Direct Oral Anticoagulants):
            - Apixaban (Eliquis): 5mg BID, reduce to 2.5mg if 2 of: age≥80, weight≤60kg, Cr≥1.5
            - Rivaroxaban (Xarelto): 20mg daily with food
            - Dabigatran (Pradaxa): 150mg BID, 75mg if CrCl 15-30
            
            DOAC ADVANTAGES:
            - No INR monitoring
            - Fewer drug interactions
            - Rapid onset/offset
            
            DOAC DISADVANTAGES:
            - Cost
            - Renal clearance (especially dabigatran)
            - Limited reversal agents
            
            PERIOPERATIVE MANAGEMENT:
            - Low bleed risk: Hold 1-2 days
            - High bleed risk: Hold 2-4 days
            - Bridging rarely needed with DOACs
        """).strip(),
        "source": "anticoagulation_guidelines"
    },
    
    # Pain Management
    {
        "content": textwrap.dedent("""
            PAIN MANAGEMENT GUIDELINES:
            
            STEP 1 - NON-OPIOID:
            - Acetaminophen: Max 3g/day (2g if liver disease)
            - NSAIDs: Ibuprofen 400mg TID, Naproxen 250mg BID
            - NSAID cautions: GI bleed, renal, CV risk
            
            STEP 2 - WEAK OPIOID:
            - Tramadol: 50-100mg q6h PRN (seizure risk, serotonin syndrome)
            - Codeine: Poor metabolizers ineffective
            
            STEP 3 - STRONG OPIOID:
            - Morphine: Gold standard, start 5-10mg q4h
            - Oxycodone: 1.5x potent vs morphine
            - Hydromorphone: 4-7x potent vs morphine
            
            OPIOID CONVERSION (Approximate):
            - Morphine 30mg PO = Oxycodone 20mg = Hydromorphone 6mg
            - Reduce 25-50% when switching agents
            
            ADJUVANTS:
            - Neuropathic: Gabapentin, pregabalin, duloxetine
            - Bone pain: Bisphosphonates, denosumab
            - Muscle spasm: Cyclobenzaprine (short-term)
            
            OPIOID SAFETY:
            - Prescribe naloxone with high doses
            - Avoid benzos if possible
            - Check PDMP before prescribing
        """).strip(),
        "source": "pain_management_guidelines"
    },

    # Hypertension Guidelines
    {
        "content": textwrap.dedent("""
            HYPERTENSION TREATMENT GUIDELINES:
            
            BP TARGETS (per ACC/AHA 2017):
            - General: <130/80 mmHg
            - Elderly (≥65): <130 systolic if tolerated
            - Diabetes/CKD: <130/80 mmHg
            
            FIRST-LINE AGENTS:
            - ACE-I/ARB: Preferred if diabetes, CKD, heart failure
            - CCB (amlodipine): Good for elderly, African American
            - Thiazide: Effective monotherapy, watch K+
            
            SPECIAL POPULATIONS:
            - African American: CCB or thiazide first-line
            - Diabetes: ACE-I or ARB mandatory
            - Heart failure: ACE-I + beta-blocker + diuretic
            - Pregnancy: Labetalol, nifedipine, methyldopa
            
            COMBINATION THERAPY:
            - If BP >20/10 above goal, start 2 drugs
            - ACE-I + CCB: Effective combination
            - AVOID: ACE-I + ARB together (no benefit, more harm)
            
            RESISTANT HYPERTENSION (3+ drugs including diuretic):
            - Add spironolactone 25-50mg
            - Check for secondary causes
            - Consider referral to specialist
        """).strip(),
        "source": "hypertension_treatment"
    }
]


async def main():
    logger.info(" Starting medical knowledge base ingestion...")
    logger.info(" Documents to ingest: %d", len(SAMPLE_DOCUMENTS))
    
    success_count = 0
    failure_count = 0
    
    for i, doc in enumerate(SAMPLE_DOCUMENTS, 1):
        try:
            result = await rag_service.ingest_text(doc["content"], doc["source"])
            if result:
                logger.info(" [%d/%d] Ingested: %s", i, len(SAMPLE_DOCUMENTS), doc['source'])
                success_count += 1
            else:
                logger.warning(" [%d/%d] Failed: %s", i, len(SAMPLE_DOCUMENTS), doc['source'])
                failure_count += 1
        except Exception:
            logger.exception(" [%d/%d] Error ingesting %s", i, len(SAMPLE_DOCUMENTS), doc['source'])
            failure_count += 1
    
    logger.info("=" * 50)
    logger.info("INGESTION SUMMARY")
    logger.info("    Succeeded: %d/%d", success_count, len(SAMPLE_DOCUMENTS))
    logger.info("    Failed: %d/%d", failure_count, len(SAMPLE_DOCUMENTS))
    logger.info("=" * 50)
    
    if success_count == len(SAMPLE_DOCUMENTS):
        logger.info(" All documents ingested successfully!")
    elif success_count > 0:
        logger.warning(" Partial ingestion - some documents failed")
    else:
        logger.error(" Complete failure - no documents ingested")


if __name__ == "__main__":
    asyncio.run(main())
