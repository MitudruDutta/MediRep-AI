# MediRep AI Backend

A powerful medical representative AI backend powered by **Google Gemini**. Provides drug information, interaction checking, pill identification, and FDA alerts via a RESTful API.

## 🚀 Features

| Feature                    | Description                                     |
| -------------------------- | ----------------------------------------------- |
| **💬 AI Chat**             | Medical Q&A powered by Gemini 2.5 Flash         |
| **🎙️ Voice AI**            | High-precision speech-to-text via ElevenLabs    |
| **💊 Drug Search**         | Search drugs via openFDA database               |
| **⚠️ Interaction Checker** | AI-powered drug-drug interaction analysis       |
| **📸 Pill Identification** | Vision AI to identify pills from photos         |
| **🚨 FDA Alerts**          | Real-time recalls and safety alerts             |
| **🧑‍⚕️ Pharmacist Portal**   | Backend verification and marketplace logic      |
| **🔍 RAG System**          | Context-aware responses using vector embeddings |

## 📋 Tech Stack

- **Framework**: FastAPI
- **AI**: Google Gemini 2.5 Flash
- **Voice**: ElevenLabs (Transcription & Synthesis)
- **Database**: Supabase (PostgreSQL + pgvector)
- **APIs**: openFDA (labels, enforcement)
- **Auth**: Supabase JWT

## 🛠️ Setup

### 1. Clone and Install

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

**Required Keys:**

- `GEMINI_API_KEY` - Get from [Google AI Studio](https://aistudio.google.com/)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Supabase anon key
- `ELEVENLABS_API_KEY` - Get from [ElevenLabs](https://elevenlabs.io/) (Optional)
- `GEMINI_MODEL` - Model name (default: `gemini-2.5-flash`)
- `PORT` - Server port (default: `8000`)

### 3. Database Setup (Supabase)

Enable `pgvector` extension and create tables:

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- RAG document chunks with vector index
CREATE TABLE document_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB,
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create HNSW index for fast similarity search
CREATE INDEX ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(768),
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        document_chunks.id,
        document_chunks.content,
        document_chunks.metadata,
        1 - (document_chunks.embedding <=> query_embedding) AS similarity
    FROM document_chunks
    ORDER BY document_chunks.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Chat history
CREATE TABLE chat_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    patient_context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved drugs with unique constraint
CREATE TABLE saved_drugs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    drug_name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_drug UNIQUE (user_id, drug_name)
);

-- Indian Medicines Database
CREATE TABLE indian_drugs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    generic_name TEXT,
    manufacturer TEXT,
    price_raw TEXT,         -- e.g. "₹120"
    price NUMERIC,          -- e.g. 120.00
    pack_size TEXT,
    is_discontinued BOOLEAN DEFAULT FALSE,
    therapeutic_class TEXT,
    action_class TEXT,
    side_effects TEXT,
    substitutes TEXT[],     -- Array of brand names
    embedding vector(768),  -- For semantic search
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fuzzy search index for drugs
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_indian_drugs_name ON indian_drugs USING GIN (name gin_trgm_ops);
CREATE INDEX idx_indian_drugs_generic ON indian_drugs USING GIN (generic_name gin_trgm_ops);
```

### 4. Ingest Indian Medicines Data

Download the dataset and run the ingestion script:

```bash
# Ensure A_Z_medicines_dataset_of_India.csv is in data/ directory
python ingest_indian_drugs.py
```

### 4. Run the Server

```bash
# From the backend directory
uvicorn main:app --reload --port 8000
```

## 📡 API Endpoints

### Health Check

```
GET /health
```

### Chat

```
POST /api/chat
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "message": "What are the side effects of Metformin?",
  "patient_context": {
    "age": 45,
    "conditions": ["diabetes"],
    "currentMeds": ["lisinopril"],
    "allergies": ["penicillin"]
  },
  "history": []
}
```

### Drug Search

```
GET /api/drugs/search?q=aspirin
```

### Drug Info

```
GET /api/drugs/{drug_name}
```

### Generic Substitutes

```
GET /api/drugs/substitutes?drug_name=dolo
```

### Drug Interactions

```
POST /api/drugs/interactions
Content-Type: application/json

{
  "drugs": ["warfarin", "aspirin"]
}
```

### Pill Identification

```
POST /api/vision/identify-pill
Content-Type: multipart/form-data

file: <image_file>
```

### FDA Alerts

```
GET /api/alerts/{drug_name}
```

### Saved Drugs (Auth Required)

```
POST /api/drugs/saved
GET /api/drugs/saved
```

## 📁 Project Structure

```
backend/
├── main.py              # FastAPI app entry
├── config.py            # Environment configuration
├── models.py            # Pydantic models
├── dependencies.py      # Auth dependencies
├── routers/
│   ├── chat.py          # Chat endpoint
│   ├── drugs.py         # Drug search/info/interactions
│   ├── vision.py        # Pill identification
│   └── alerts.py        # FDA alerts
├── services/
│   ├── gemini_service.py      # Gemini AI integration
│   ├── drug_service.py        # openFDA integration
│   ├── interaction_service.py # Drug interaction AI
│   ├── vision_service.py      # Gemini Vision
│   ├── alert_service.py       # FDA enforcement API
│   ├── rag_service.py         # Vector search
│   └── supabase_service.py    # Database client
├── requirements.txt
├── .env.example
└── brutal_verify.py     # Integration tests
```

## 🧪 Testing

Run the verification suite:

```bash
python brutal_verify.py
```

## 🚀 Deployment

### Railway / Render

1. Set environment variables in dashboard
2. Deploy with:
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

## 📄 License

MIT

---

**Built with ❤️ for medical information accessibility**
