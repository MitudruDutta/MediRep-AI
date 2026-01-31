<div align="center">

<img src="frontend/public/logo.svg" alt="MediRep AI" width="72" height="72" />

# MediRep AI

**AI-powered drug intelligence + verified pharmacist marketplace.**

<p>
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#deployment">Deployment</a>
</p>

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square)
![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-4285F4?style=flat-square)

</div>

---

## Overview

MediRep AI helps clinicians, pharmacists, medical reps, and patients get fast, high-quality medication answers:
drug facts, interactions, safety alerts, pill identification, price comparison, and an escalation path to verified pharmacists.

> **Disclaimer:** MediRep AI is for informational purposes only and is **not medical advice**. Always verify against authoritative sources and consult a qualified clinician for medical decisions.

![MediRep AI landing page](website.png)

## Features

| Feature                    | Description                                               | Status  |
| -------------------------- | --------------------------------------------------------- | ------- |
| 💬 **AI Chat**             | Natural language medical Q&A with context awareness       | ✅ Live |
| 💊 **Drug Search**         | Search 100,000+ drugs via openFDA database                | ✅ Live |
| ⚡ **Clinical Speed**       | Optimized workflow for rapid evidence-based answers       | ✅ Live |
| 🧑‍⚕️ **Pharmacist Market**   | Connect with verified pharmacists for consultations       | ✅ Live |
| ⚠️ **Interaction Checker** | AI-powered drug-drug interaction analysis                 | ✅ Live |
| 🎙️ **Voice Mode**          | Speech-to-text search & consultations (ElevenLabs)        | ✅ Live |
| 📸 **Pill Scanner**        | Vision AI to identify pills from camera photos            | ✅ Live |
| 🚨 **FDA Alerts**          | Real-time recalls, warnings, and safety alerts            | ✅ Live |
| 🔍 **RAG System**          | Context-aware responses using vector embeddings           | ✅ Live |

## Quick start

### Prerequisites

- Python 3.10+ (3.11 recommended)
- Node.js 18+ and npm
- [Gemini API Key](https://aistudio.google.com/)
- [Supabase Project](https://supabase.com/)

### Backend Setup

```bash
# Clone the repository (update URL as needed)
git clone https://github.com/MitudruDutta/MediRep-AI
cd MediRep-AI

# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Create a .env file and add your API keys:
# GEMINI_API_KEY=your_gemini_api_key
# SUPABASE_URL=your_supabase_url
# SUPABASE_KEY=your_supabase_service_role_key

# Run the server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
# From project root, navigate to frontend
cd frontend

# Install dependencies
npm install

# Configure environment variables
# Create a .env.local file and add:
# NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Run development server
npm run dev
```

Access the application:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`

## API documentation

### Base URL

```
http://localhost:8000
```

### Endpoints Overview

| Method | Endpoint                    | Description              |
| ------ | --------------------------- | ------------------------ |
| `GET`  | `/health`                   | Health check             |
| `POST` | `/api/chat`                 | Chat with AI             |
| `POST` | `/api/audio/transcribe`     | Voice transcription      |
| `GET`  | `/api/drugs/search?q=`      | Search drugs             |
| `GET`  | `/api/drugs/{name}`         | Get drug details         |
| `POST` | `/api/drugs/interactions`   | Check interactions       |
| `POST` | `/api/vision/identify-pill` | Identify pill from image |
| `GET`  | `/api/alerts/{drug_name}`   | Get FDA alerts           |

### Interactive API Documentation

Once the backend is running, you can explore and test all endpoints using:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Architecture

### System Overview

![alt text](image.png)

### Data Flow

1. **User Request** → Frontend (Next.js)
2. **Authentication** → Supabase Auth validates JWT token
3. **API Call** → FastAPI backend receives request
4. **Service Layer** → Appropriate service processes the request:
   - **Chat**: Gemini AI + RAG Service (vector similarity search)
   - **Voice**: ElevenLabs API for high-accuracy transcription
   - **Drug Search**: openFDA API + caching
   - **Interactions**: Gemini AI analysis
   - **Pill ID**: Gemini Vision API
   - **Alerts**: openFDA Enforcement API
5. **Data Storage** → Supabase (chat history, saved drugs, user data)
6. **Response** → JSON response back to frontend
7. **UI Update** → React components render the data

### Tech Stack

| Layer             | Technology                                      |
| ----------------- | ----------------------------------------------- |
| **Frontend**      | Next.js 16, React 19, TypeScript                |
| **Styling**       | Tailwind CSS 4, Shadcn UI, Framer Motion, GSAP  |
| **AI Engine**     | Google Gemini 2.5 Flash                         |
| **Voice AI**      | ElevenLabs                                      |
| **Backend**       | FastAPI (Python 3.10+)                          |
| **Database**      | Supabase (PostgreSQL + pgvector)                |
| **Auth**          | Supabase Auth (JWT)                             |
| **External APIs** | openFDA (Labels, Enforcement)                   |

## Project structure

```
medirep-ai/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── config.py            # Configuration
│   ├── models.py            # Pydantic models
│   ├── dependencies.py      # Auth
│   ├── routers/             # API endpoints
│   │   ├── chat.py
│   │   ├── drugs.py
│   │   ├── vision.py
│   │   └── alerts.py
│   ├── services/            # Business logic
│   │   ├── gemini_service.py
│   │   ├── drug_service.py
│   │   ├── vision_service.py
│   │   ├── alert_service.py
│   │   ├── rag_service.py
│   │   └── supabase_service.py
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
├── frontend/
│    ├── app/             # Next.js app router
│    │   ├── auth/        # Authentication pages
│    │   ├── dashboard/   # Main dashboard
│    │   └── layout.tsx
│    ├── components/      # React components
│    │   ├── dashboard/
│    │   ├── ui/          # Radix UI components
│    │   └── account/
│    ├── lib/             # Utilities
│    │   ├── supabase/    # Supabase clients
│    │   └── api.ts       # API client
│    ├── hooks/           # Custom React hooks
│    ├── .env.local
│    └── package.json
├── LICENSE
└── README.md
```

## Configuration

### Environment Variables

#### Backend (.env)

| Variable         | Required | Description                              |
| ---------------- | -------- | ---------------------------------------- |
| `GEMINI_API_KEY` | ✅       | Google AI Studio API key                 |
| `SUPABASE_URL`   | ✅       | Supabase project URL                     |
| `SUPABASE_KEY`   | ✅       | Supabase service role key                |
| `GEMINI_MODEL`   | ❌       | Model name (default: `gemini-2.5-flash`) |
| `PORT`           | ❌       | Server port (default: `8000`)            |

#### Frontend (.env.local)

| Variable                                      | Required | Description                                |
| --------------------------------------------- | -------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                    | ✅       | Supabase project URL                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`               | ✅       | Supabase anon/publishable key              |
| `NEXT_PUBLIC_API_URL`                         | ✅       | Backend API URL (http://localhost:8000)    |
| `NEXT_PUBLIC_SITE_URL`                        | ✅       | Frontend URL (http://localhost:3000)       |

> Note: use the key that matches your Supabase project configuration. Keep service role keys **server-side only**.

## Deployment

### Backend Deployment (Railway/Heroku)

The backend includes a `Procfile` for easy deployment:

1. Push your code to GitHub
2. Connect to Railway/Heroku
3. Set environment variables in the dashboard
4. Deploy automatically

### Frontend Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from frontend directory
cd frontend/
vercel
```

**Vercel settings**
- Root Directory: `frontend`
- Production env vars:
  - `NEXT_PUBLIC_API_URL=https://<your-railway-backend-domain>` (no trailing `/`)
  - `NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>` (no trailing `/`)

**Railway settings (CORS)**
- `ENV=production`
- `ALLOWED_ORIGINS=https://<your-vercel-domain>` (comma-separated for multiple)

### Docker (Optional)

```bash
# Build backend image
docker build -t medirep-ai-backend ./backend

# Run backend container
docker run -p 8000:8000 --env-file backend/.env medirep-ai-backend
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Google Gemini](https://deepmind.google/technologies/gemini/) for AI capabilities
- [openFDA](https://open.fda.gov/) for drug data
- [Supabase](https://supabase.com/) for backend infrastructure

---

<div align="center">

**Built for better, faster medication decisions.**

[⬆ Back to Top](#medirep-ai-)

</div>
