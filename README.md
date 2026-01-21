# MediRep AI 🏥

<div align="center">

![MediRep AI](https://img.shields.io/badge/MediRep-AI-blue?style=for-the-badge&logo=google&logoColor=white)
![Gemini](https://img.shields.io/badge/Powered%20by-Gemini%202.5-4285F4?style=for-the-badge&logo=google&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

**Your AI-Powered Digital Medical Representative**

[Features](#-features) • [Quick Start](#-quick-start) • [API Docs](#-api-documentation) • [Architecture](#-architecture) • [License](#-license)

</div>

---

## 🎯 What is MediRep AI?

MediRep AI is an intelligent medical information assistant that helps healthcare professionals and patients access accurate drug information, check interactions, identify pills, and stay updated on FDA alerts — all powered by Google Gemini AI.

> ⚠️ **Disclaimer**: MediRep AI is for informational purposes only. Always consult a healthcare professional for medical advice.

## ✨ Features

| Feature                    | Description                                         | Status  |
| -------------------------- | --------------------------------------------------- | ------- |
| 💬 **AI Chat**             | Natural language medical Q&A with context awareness | ✅ Live |
| 💊 **Drug Search**         | Search 100,000+ drugs via openFDA database          | ✅ Live |
| ⚠️ **Interaction Checker** | AI-powered drug-drug interaction analysis           | ✅ Live |
| 📸 **Pill Scanner**        | Vision AI to identify pills from camera photos      | ✅ Live |
| 🚨 **FDA Alerts**          | Real-time recalls, warnings, and safety alerts      | ✅ Live |
| 🔍 **RAG System**          | Context-aware responses using vector embeddings     | ✅ Live |
| 👤 **User Accounts**       | Save drugs, chat history via Supabase Auth          | ✅ Live |

## 🚀 Quick Start

### Prerequisites

- Python 3.10+ (3.11 recommended)
- [Gemini API Key](https://aistudio.google.com/)
- [Supabase Project](https://supabase.com/)

### Backend Setup

```bash
# Clone the repository
# Replace <your-username> with your GitHub username or fork
git clone https://github.com/<your-username>/medirep-ai.git
cd medirep-ai

# Setup backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run the server (from backend directory)
uvicorn main:app --reload --port 8000
```

### Verify Installation

```bash
# Run from backend directory
cd backend
python brutal_verify.py
```

The API will be available at `http://localhost:8000`

## 📡 API Documentation

### Base URL

```
http://localhost:8000
```

### Endpoints Overview

| Method | Endpoint                    | Description              |
| ------ | --------------------------- | ------------------------ |
| `GET`  | `/health`                   | Health check             |
| `POST` | `/api/chat`                 | Chat with AI             |
| `GET`  | `/api/drugs/search?q=`      | Search drugs             |
| `GET`  | `/api/drugs/{name}`         | Get drug details         |
| `POST` | `/api/drugs/interactions`   | Check interactions       |
| `POST` | `/api/vision/identify-pill` | Identify pill from image |
| `GET`  | `/api/alerts/{drug_name}`   | Get FDA alerts           |

### Interactive Docs

Once running, access Swagger UI at:

```
http://localhost:8000/docs
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        MediRep AI                          │
├─────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   Frontend  │────▶│   FastAPI  │───▶│  Supabase   │   │
│  │  (Next.js)  │     │   Backend   │     │  (Postgres) │   │
│  └─────────────┘     └──────┬──────┘     └─────────────┘   │
│                             │                              │
│         ┌───────────────────┼───────────────────┐          │
│         ▼                   ▼                   ▼          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   Gemini    │     │   openFDA   │     │   RAG       │   │
│  │   2.5 Flash │     │   API       │     │   (pgvector)│   │
│  └─────────────┘     └─────────────┘     └─────────────┘   │
│                                                            │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer             | Technology                       |
| ----------------- | -------------------------------- |
| **AI Engine**     | Google Gemini 2.5 Flash          |
| **Backend**       | FastAPI (Python 3.10+)           |
| **Database**      | Supabase (PostgreSQL + pgvector) |
| **Auth**          | Supabase Auth (JWT)              |
| **External APIs** | openFDA (Labels, Enforcement)    |

## 📁 Project Structure

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
├── frontend/                # (Coming Soon)
├── LICENSE
└── README.md
```

## 🔧 Configuration

### Environment Variables

| Variable         | Required | Description                              |
| ---------------- | -------- | ---------------------------------------- |
| `GEMINI_API_KEY` | ✅       | Google AI Studio API key                 |
| `SUPABASE_URL`   | ✅       | Supabase project URL                     |
| `SUPABASE_KEY`   | ✅       | Supabase anon key                        |
| `GEMINI_MODEL`   | ❌       | Model name (default: `gemini-2.5-flash`) |
| `PORT`           | ❌       | Server port (default: `8000`)            |

## 🚀 Deployment

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app)

1. Connect your GitHub repo
2. Set environment variables
3. Deploy!

### Docker

```bash
docker build -t medirep-ai ./backend
docker run -p 8000:8000 --env-file .env medirep-ai
```

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Google Gemini](https://deepmind.google/technologies/gemini/) for AI capabilities
- [openFDA](https://open.fda.gov/) for drug data
- [Supabase](https://supabase.com/) for backend infrastructure

---

<div align="center">

**Built with ❤️ for better healthcare information access**

[⬆ Back to Top](#medirep-ai-)

</div>
