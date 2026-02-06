#!/usr/bin/env python3
"""
Generate complete training dataset for MediRep Voice AI.
ALL DATA PULLED FROM REAL DATABASES - NO HARDCODED VALUES.

Requires:
  - Turso database connection (for drugs)
  - Supabase connection (for PM-JAY, pharma companies)

Run from the voice directory:
    cd voice && python scripts/generate_full_dataset.py
"""

import json
import os
import random
import sys
import asyncio

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

DATA_DIR = os.path.join(os.path.dirname(__file__), '../data')
RAW_DIR = f'{DATA_DIR}/raw'
GEN_DIR = f'{DATA_DIR}/generated'
FINAL_DIR = f'{DATA_DIR}/final'

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(GEN_DIR, exist_ok=True)
os.makedirs(FINAL_DIR, exist_ok=True)


# ============================================================
# SECTION 1: DATA LOADING FROM REAL DATABASES
# ============================================================

def load_drugs_from_turso(limit=10000):
    """Load real drugs from Turso database."""
    try:
        from services import turso_service
        conn = turso_service.get_connection()
        if not conn:
            print("WARNING: Turso connection failed")
            return []

        rs = conn.execute("""
            SELECT name, generic_name, therapeutic_class, manufacturer, price, price_raw
            FROM drugs
            WHERE name IS NOT NULL
              AND generic_name IS NOT NULL
              AND therapeutic_class IS NOT NULL
            ORDER BY RANDOM()
            LIMIT ?
        """, (limit,))

        drugs = [
            {
                "name": row[0],
                "generic_name": row[1],
                "therapeutic_class": row[2],
                "manufacturer": row[3] or "Unknown",
                "price": row[4],
                "price_raw": row[5] or "Price varies"
            }
            for row in rs.rows
        ]

        # Save raw data
        with open(f'{RAW_DIR}/drugs_sample.json', 'w') as f:
            json.dump(drugs, f, indent=2)

        print(f"Loaded {len(drugs)} drugs from Turso")
        return drugs

    except Exception as e:
        print(f"ERROR loading drugs: {e}")
        return []


def load_pmjay_from_supabase():
    """Load real PM-JAY procedures from Supabase."""
    try:
        from services.supabase_service import SupabaseService
        client = SupabaseService.get_client()
        result = client.table("insurance_package_rates").select("*").execute()

        procedures = result.data or []

        # Save raw data
        with open(f'{RAW_DIR}/pmjay_procedures.json', 'w') as f:
            json.dump(procedures, f, indent=2)

        print(f"Loaded {len(procedures)} PM-JAY procedures from Supabase")
        return procedures

    except Exception as e:
        print(f"ERROR loading PM-JAY: {e}")
        return []


def load_pharma_companies_from_supabase():
    """Load real pharma companies and support programs from Supabase."""
    try:
        from services.supabase_service import SupabaseService
        client = SupabaseService.get_client()

        companies = client.table("pharma_companies").select(
            "*, pharma_support_programs(*)"
        ).execute()

        data = companies.data or []

        # Save raw data
        with open(f'{RAW_DIR}/pharma_companies.json', 'w') as f:
            json.dump(data, f, indent=2)

        print(f"Loaded {len(data)} pharma companies from Supabase")
        return data

    except Exception as e:
        print(f"ERROR loading pharma companies: {e}")
        return []


def load_insurance_schemes_from_supabase():
    """Load real insurance schemes from Supabase."""
    try:
        from services.supabase_service import SupabaseService
        client = SupabaseService.get_client()
        result = client.table("insurance_schemes").select("*").execute()

        schemes = result.data or []

        # Save raw data
        with open(f'{RAW_DIR}/insurance_schemes.json', 'w') as f:
            json.dump(schemes, f, indent=2)

        print(f"Loaded {len(schemes)} insurance schemes from Supabase")
        return schemes

    except Exception as e:
        print(f"ERROR loading insurance schemes: {e}")
        return []


def extract_unique_drug_classes(drugs):
    """Extract unique therapeutic classes from loaded drugs."""
    classes = set()
    for drug in drugs:
        tc = drug.get('therapeutic_class', '')
        if tc and len(tc) > 2:
            classes.add(tc)
    return list(classes)


def extract_drug_pairs_for_comparison(drugs):
    """Extract drug pairs from same therapeutic class for comparison training."""
    # Group drugs by therapeutic class
    by_class = {}
    for drug in drugs:
        tc = drug.get('therapeutic_class', '')
        if not tc:
            continue
        if tc not in by_class:
            by_class[tc] = []
        by_class[tc].append(drug)

    # Create pairs from same class
    pairs = []
    for tc, class_drugs in by_class.items():
        if len(class_drugs) >= 2:
            # Take up to 5 pairs per class
            for i in range(min(5, len(class_drugs) - 1)):
                pairs.append((class_drugs[i], class_drugs[i + 1]))

    return pairs


# ============================================================
# SECTION 2: CONVERSATION GENERATION FROM REAL DATA
# ============================================================

def generate_drug_conversations(drugs):
    """Generate drug-related conversations from REAL drug data."""
    if not drugs:
        print("No drugs loaded - skipping drug conversations")
        return []

    conversations = []

    for drug in drugs:
        name = drug.get('name', '')
        generic = drug.get('generic_name', '')
        therapeutic = drug.get('therapeutic_class', '')
        manufacturer = drug.get('manufacturer', '')
        price_raw = drug.get('price_raw', 'Price varies')

        if not name or not generic:
            continue

        # Template 1: Basic info with tool call
        conversations.append({
            "conversations": [
                {"role": "user", "content": f"Tell me about {name}"},
                {"role": "assistant", "content": f'<tool_call>search_drugs</tool_call>\n<params>{{"query": "{name}"}}</params>'},
                {"role": "tool_result", "content": json.dumps(drug)},
                {"role": "assistant", "content": f"{name} (generic: {generic}) is a {therapeutic} medication. Manufactured by {manufacturer}. Price: {price_raw}."}
            ]
        })

        # Template 2: Side effects question
        conversations.append({
            "conversations": [
                {"role": "user", "content": f"What are the side effects of {name}?"},
                {"role": "assistant", "content": f'<tool_call>search_drugs</tool_call>\n<params>{{"query": "{name}"}}</params>'},
                {"role": "tool_result", "content": json.dumps(drug)},
                {"role": "assistant", "content": f"{name} ({generic}) is a {therapeutic} medication. Side effects vary by individual. Common ones depend on the drug class. Consult your doctor or pharmacist for specific side effect information."}
            ]
        })

        # Template 3: Price inquiry
        conversations.append({
            "conversations": [
                {"role": "user", "content": f"How much does {name} cost?"},
                {"role": "assistant", "content": f'<tool_call>search_drugs</tool_call>\n<params>{{"query": "{name}"}}</params>'},
                {"role": "tool_result", "content": json.dumps(drug)},
                {"role": "assistant", "content": f"{name} by {manufacturer} costs approximately {price_raw}. Generic alternatives ({generic}) may be available at lower prices."}
            ]
        })

        # Template 4: Web search for latest news (every 10th drug)
        if random.random() < 0.1:
            conversations.append({
                "conversations": [
                    {"role": "user", "content": f"What's the latest news about {name}?"},
                    {"role": "assistant", "content": f'<tool_call>web_search</tool_call>\n<params>{{"query": "{name} {generic} latest news medical"}}</params>'},
                    {"role": "tool_result", "content": f'[{{"title": "Latest on {name}", "snippet": "Recent updates...", "url": "https://example.com"}}]'},
                    {"role": "assistant", "content": f"Based on recent information about {name} ({generic}): This {therapeutic} medication continues to be used for its intended purposes. For the most current clinical updates, consult medical literature or your healthcare provider."}
                ]
            })

    # Save
    output_path = f'{GEN_DIR}/drug_conversations.jsonl'
    with open(output_path, 'w') as f:
        for conv in conversations:
            f.write(json.dumps(conv) + '\n')

    print(f"Generated {len(conversations)} drug conversations -> {output_path}")
    return conversations


def generate_comparison_conversations(drug_pairs):
    """Generate drug comparison conversations from REAL drug pairs."""
    if not drug_pairs:
        print("No drug pairs - skipping comparison conversations")
        return []

    conversations = []

    for drug1, drug2 in drug_pairs:
        name1 = drug1.get('name', '')
        name2 = drug2.get('name', '')
        generic1 = drug1.get('generic_name', '')
        generic2 = drug2.get('generic_name', '')
        therapeutic = drug1.get('therapeutic_class', '')
        price1 = drug1.get('price') or 0
        price2 = drug2.get('price') or 0

        if not name1 or not name2:
            continue

        # Calculate actual savings if prices available
        if price1 and price2 and price1 > 0 and price2 > 0:
            if price1 > price2:
                savings = round((price1 - price2) / price1 * 100)
                cheaper = name2
            else:
                savings = round((price2 - price1) / price2 * 100)
                cheaper = name1
            savings_text = f"{cheaper} is approximately {savings}% cheaper."
        else:
            savings_text = "Prices vary by pharmacy and location."

        # Comparison conversation
        conversations.append({
            "conversations": [
                {"role": "user", "content": f"Compare {name1} and {name2}"},
                {"role": "assistant", "content": f'<tool_call>compare_drugs</tool_call>\n<params>{{"drug1": "{name1}", "drug2": "{name2}"}}</params>'},
                {"role": "tool_result", "content": json.dumps({"drug1": drug1, "drug2": drug2})},
                {"role": "assistant", "content": f"Comparing {name1} ({generic1}) vs {name2} ({generic2}): Both are {therapeutic} medications. {savings_text} Your doctor can advise which is most appropriate for your condition."}
            ]
        })

        # Alternative phrasing
        conversations.append({
            "conversations": [
                {"role": "user", "content": f"What's the difference between {name1} and {name2}?"},
                {"role": "assistant", "content": f'<tool_call>compare_drugs</tool_call>\n<params>{{"drug1": "{name1}", "drug2": "{name2}"}}</params>'},
                {"role": "tool_result", "content": json.dumps({"drug1": drug1, "drug2": drug2})},
                {"role": "assistant", "content": f"{name1} and {name2} are both in the {therapeutic} class. {name1} contains {generic1}, while {name2} contains {generic2}. {savings_text}"}
            ]
        })

    # Save
    output_path = f'{GEN_DIR}/comparison_conversations.jsonl'
    with open(output_path, 'w') as f:
        for conv in conversations:
            f.write(json.dumps(conv) + '\n')

    print(f"Generated {len(conversations)} comparison conversations -> {output_path}")
    return conversations


def generate_class_listing_conversations(drugs):
    """Generate drug class listing conversations from REAL data."""
    if not drugs:
        return []

    # Group drugs by therapeutic class
    by_class = {}
    for drug in drugs:
        tc = drug.get('therapeutic_class', '')
        if not tc or len(tc) < 3:
            continue
        if tc not in by_class:
            by_class[tc] = []
        by_class[tc].append(drug.get('name', ''))

    conversations = []

    for class_name, drug_names in by_class.items():
        if len(drug_names) < 2:
            continue

        # Take first 10 drugs as examples
        example_drugs = drug_names[:10]

        conversations.append({
            "conversations": [
                {"role": "user", "content": f"List drugs in the {class_name} class"},
                {"role": "assistant", "content": f'<tool_call>list_drug_class</tool_call>\n<params>{{"class_name": "{class_name}"}}</params>'},
                {"role": "tool_result", "content": json.dumps({"class": class_name, "drugs": example_drugs, "total": len(drug_names)})},
                {"role": "assistant", "content": f"{class_name} medications include: {', '.join(example_drugs[:5])}{'...' if len(example_drugs) > 5 else ''}. There are {len(drug_names)} drugs in this class in our database."}
            ]
        })

        # Alternative phrasing
        conversations.append({
            "conversations": [
                {"role": "user", "content": f"What drugs are {class_name}s?"},
                {"role": "assistant", "content": f'<tool_call>list_drug_class</tool_call>\n<params>{{"class_name": "{class_name}"}}</params>'},
                {"role": "tool_result", "content": json.dumps({"class": class_name, "drugs": example_drugs})},
                {"role": "assistant", "content": f"Drugs in the {class_name} class include: {', '.join(example_drugs[:5])}. These medications share similar mechanisms of action."}
            ]
        })

    # Save
    output_path = f'{GEN_DIR}/class_listing_conversations.jsonl'
    with open(output_path, 'w') as f:
        for conv in conversations:
            f.write(json.dumps(conv) + '\n')

    print(f"Generated {len(conversations)} class listing conversations -> {output_path}")
    return conversations


def generate_insurance_conversations(procedures):
    """Generate PM-JAY insurance conversations from REAL data."""
    if not procedures:
        print("No procedures loaded - skipping insurance conversations")
        return []

    conversations = []

    for proc in procedures:
        proc_name = proc.get('procedure_name', '')
        rate = proc.get('rate_inr', 0)
        code = proc.get('package_code', '')
        category = proc.get('category', '')
        specialty = proc.get('specialty', '')

        if not proc_name or not rate:
            continue

        # Format rate as Indian currency
        rate_formatted = f"Rs. {rate:,}"

        # Template 1: Direct rate inquiry
        conversations.append({
            "conversations": [
                {"role": "user", "content": f"What is the PM-JAY rate for {proc_name}?"},
                {"role": "assistant", "content": f'<tool_call>get_insurance_rate</tool_call>\n<params>{{"procedure": "{proc_name}"}}</params>'},
                {"role": "tool_result", "content": json.dumps(proc)},
                {"role": "assistant", "content": f"Under PM-JAY (Ayushman Bharat), {proc_name} is covered at {rate_formatted}. Package code: {code}. Category: {category}. Specialty: {specialty}."}
            ]
        })

        # Template 2: Coverage question
        conversations.append({
            "conversations": [
                {"role": "user", "content": f"Is {proc_name} covered under Ayushman Bharat?"},
                {"role": "assistant", "content": f'<tool_call>get_insurance_rate</tool_call>\n<params>{{"procedure": "{proc_name}"}}</params>'},
                {"role": "tool_result", "content": json.dumps(proc)},
                {"role": "assistant", "content": f"Yes, {proc_name} is covered under PM-JAY at {rate_formatted}. This includes hospital stay and standard follow-up care. Package: {code}."}
            ]
        })

        # Template 3: Cost question
        conversations.append({
            "conversations": [
                {"role": "user", "content": f"How much does {proc_name} cost under government insurance?"},
                {"role": "assistant", "content": f'<tool_call>get_insurance_rate</tool_call>\n<params>{{"procedure": "{proc_name}"}}</params>'},
                {"role": "tool_result", "content": json.dumps(proc)},
                {"role": "assistant", "content": f"Under PM-JAY government insurance, {proc_name} is covered at {rate_formatted}. This is a {category} procedure under {specialty}. Code: {code}."}
            ]
        })

    # Save
    output_path = f'{GEN_DIR}/insurance_conversations.jsonl'
    with open(output_path, 'w') as f:
        for conv in conversations:
            f.write(json.dumps(conv) + '\n')

    print(f"Generated {len(conversations)} insurance conversations -> {output_path}")
    return conversations


def generate_pharma_rep_conversations(companies):
    """Generate pharma rep mode conversations from REAL company data."""
    if not companies:
        print("No companies loaded - skipping pharma rep conversations")
        return []

    conversations = []

    for company in companies:
        name = company.get('company_name', '')
        description = company.get('description', '')
        focus_areas = company.get('focus_areas', [])
        differentiators = company.get('differentiators', [])
        contact = company.get('contact_email', '')
        programs = company.get('pharma_support_programs', [])

        if not name:
            continue

        # Company overview
        focus_text = ', '.join(focus_areas) if focus_areas else 'various therapeutic areas'
        diff_text = ', '.join(differentiators[:3]) if differentiators else 'quality and innovation'

        conversations.append({
            "conversations": [
                {"role": "user", "content": f"Tell me about {name}"},
                {"role": "assistant", "content": f'<tool_call>pharma_rep_info</tool_call>\n<params>{{"company": "{name}"}}</params>'},
                {"role": "tool_result", "content": json.dumps(company)},
                {"role": "assistant", "content": f"As a {name} representative: {description} Our focus areas include {focus_text}. Key strengths: {diff_text}. Contact: {contact}"}
            ]
        })

        # Products question
        conversations.append({
            "conversations": [
                {"role": "user", "content": f"What products does {name} make?"},
                {"role": "assistant", "content": f'<tool_call>pharma_rep_info</tool_call>\n<params>{{"company": "{name}"}}</params>'},
                {"role": "tool_result", "content": json.dumps(company)},
                {"role": "assistant", "content": f"{name} specializes in {focus_text}. {description} For detailed product catalogs, contact: {contact}"}
            ]
        })

        # Support programs
        for prog in programs:
            prog_name = prog.get('program_name', '')
            prog_desc = prog.get('description', '')
            prog_contact = prog.get('contact_info', contact)

            if not prog_name:
                continue

            conversations.append({
                "conversations": [
                    {"role": "user", "content": f"What patient support does {name} offer?"},
                    {"role": "assistant", "content": f'<tool_call>pharma_rep_info</tool_call>\n<params>{{"company": "{name}"}}</params>'},
                    {"role": "tool_result", "content": json.dumps({"company": company, "program": prog})},
                    {"role": "assistant", "content": f"{name} offers the {prog_name} program: {prog_desc} Contact: {prog_contact}"}
                ]
            })

    # Save
    output_path = f'{GEN_DIR}/pharma_rep_conversations.jsonl'
    with open(output_path, 'w') as f:
        for conv in conversations:
            f.write(json.dumps(conv) + '\n')

    print(f"Generated {len(conversations)} pharma rep conversations -> {output_path}")
    return conversations


def generate_no_tool_conversations():
    """
    Generate conversations that DON'T need tools.
    These are general knowledge / conversational - no database lookup needed.
    """
    # These are genuinely static - general medical concepts that don't change
    conversations = []

    general_examples = [
        # Greetings
        ("Hello", "Hello! I'm MediRep AI, your medical information assistant. I can help with drug information, insurance coverage, and more. How can I help you today?"),
        ("Hi", "Hi! I'm here to help with medication information, drug comparisons, and PM-JAY insurance queries. What would you like to know?"),
        ("Good morning", "Good morning! I'm MediRep AI. Ask me about medications, prices, or insurance coverage."),

        # Thanks
        ("Thank you", "You're welcome! Let me know if you have any other questions."),
        ("Thanks", "Happy to help! Feel free to ask anything else."),
        ("That's helpful", "Glad I could assist! Is there anything else you'd like to know?"),

        # General concepts (these are medical facts, not database lookups)
        ("What's the difference between generic and branded medicines?",
         "Generic medicines contain the same active ingredients as branded versions but typically cost 30-80% less. They must meet the same quality, safety, and efficacy standards set by regulatory authorities. The main differences are the name and price."),

        ("How do antibiotics work?",
         "Antibiotics work by either killing bacteria (bactericidal) or stopping their growth (bacteriostatic). Different classes target different bacterial components - cell walls, protein synthesis, DNA replication, or metabolic pathways. They don't work against viruses."),

        ("What is drug interaction?",
         "Drug interactions occur when two or more substances affect each other's effectiveness or cause unexpected side effects. This includes prescription drugs, OTC medications, supplements, and even food. Always inform your doctor about all medications you take."),

        # Boundaries
        ("Should I take this medicine?",
         "I can provide information about medications, but I cannot give personal medical advice. Please consult your doctor or pharmacist for guidance on whether a specific medicine is right for you."),

        ("Can you diagnose my condition?",
         "I'm not able to diagnose medical conditions. I can provide general information about medications and health topics, but for diagnosis and treatment, please consult a healthcare professional."),

        # Clarifications
        ("I don't understand",
         "I apologize for the confusion. Could you tell me what part is unclear? I'll try to explain it more simply."),

        ("What do you mean?",
         "Let me clarify. What specific part would you like me to explain better?"),
    ]

    for user_msg, assistant_msg in general_examples:
        conversations.append({
            "conversations": [
                {"role": "user", "content": user_msg},
                {"role": "assistant", "content": assistant_msg}
            ]
        })

    # Save
    output_path = f'{GEN_DIR}/no_tool_conversations.jsonl'
    with open(output_path, 'w') as f:
        for conv in conversations:
            f.write(json.dumps(conv) + '\n')

    print(f"Generated {len(conversations)} no-tool conversations -> {output_path}")
    return conversations


def merge_all_datasets():
    """Merge all generated conversations into train/val/test splits."""
    all_conversations = []

    # Load all generated files
    for filename in os.listdir(GEN_DIR):
        if filename.endswith('.jsonl'):
            filepath = f'{GEN_DIR}/{filename}'
            with open(filepath, 'r') as f:
                for line in f:
                    try:
                        conv = json.loads(line.strip())
                        all_conversations.append(conv)
                    except json.JSONDecodeError:
                        continue

    if not all_conversations:
        print("ERROR: No conversations generated!")
        return [], [], []

    print(f"\nTotal conversations: {len(all_conversations)}")

    # Shuffle
    random.shuffle(all_conversations)

    # Split: 80% train, 10% val, 10% test
    n = len(all_conversations)
    train_end = int(0.8 * n)
    val_end = int(0.9 * n)

    train = all_conversations[:train_end]
    val = all_conversations[train_end:val_end]
    test = all_conversations[val_end:]

    # Save splits
    for name, data in [('train', train), ('val', val), ('test', test)]:
        filepath = f'{FINAL_DIR}/{name}.jsonl'
        with open(filepath, 'w') as f:
            for conv in data:
                f.write(json.dumps(conv) + '\n')
        print(f"{name}: {len(data)} conversations -> {filepath}")

    return train, val, test


def main():
    print("=" * 60)
    print("MediRep Voice AI - Dataset Generation")
    print("ALL DATA FROM REAL DATABASES")
    print("=" * 60)

    # Step 1: Load real data from databases
    print("\n[1/7] Loading drugs from Turso...")
    drugs = load_drugs_from_turso(limit=10000)

    print("\n[2/7] Loading PM-JAY procedures from Supabase...")
    procedures = load_pmjay_from_supabase()

    print("\n[3/7] Loading pharma companies from Supabase...")
    companies = load_pharma_companies_from_supabase()

    print("\n[4/7] Loading insurance schemes from Supabase...")
    schemes = load_insurance_schemes_from_supabase()

    # Step 2: Generate conversations from real data
    print("\n[5/7] Generating conversations from real data...")

    generate_drug_conversations(drugs)

    drug_pairs = extract_drug_pairs_for_comparison(drugs)
    generate_comparison_conversations(drug_pairs)

    generate_class_listing_conversations(drugs)

    generate_insurance_conversations(procedures)

    generate_pharma_rep_conversations(companies)

    generate_no_tool_conversations()

    # Step 3: Merge all
    print("\n[6/7] Merging all datasets...")
    train, val, test = merge_all_datasets()

    # Summary
    print("\n" + "=" * 60)
    print("DATASET GENERATION COMPLETE")
    print("=" * 60)
    print(f"\nRaw data saved in: {RAW_DIR}")
    print(f"Generated conversations in: {GEN_DIR}")
    print(f"Final splits in: {FINAL_DIR}")
    print(f"\n  - train.jsonl: {len(train)} conversations")
    print(f"  - val.jsonl: {len(val)} conversations")
    print(f"  - test.jsonl: {len(test)} conversations")
    print("\nData sources used:")
    print(f"  - Drugs from Turso: {len(drugs)}")
    print(f"  - PM-JAY procedures: {len(procedures)}")
    print(f"  - Pharma companies: {len(companies)}")
    print(f"  - Insurance schemes: {len(schemes)}")
    print("\nNext: Upload train.jsonl and val.jsonl to Colab for fine-tuning")


if __name__ == "__main__":
    main()
