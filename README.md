# ⚡ Nexus RAG: Enterprise AI Document Assistant

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/Production-Ready-brightgreen.svg)](#)

> A production-grade **Enterprise Retrieval-Augmented Generation (RAG) Platform** featuring verified citations, hybrid vector/lexical retrieval, streaming AI responses, conversation history, multi-tenant authentication, and single-command Docker deployment.

---

## 🌟 Key Features

| Feature | Description |
| :--- | :--- |
| 📄 **PDF Upload & Processing** | Drag-and-drop enterprise PDF ingestion with page tracking, metadata preservation, and recursive semantic chunking. |
| 🔍 **Semantic & Hybrid Search** | Blends dense vector cosine similarity (70%) with BM25 lexical keyword matching (30%) for maximum retrieval precision. |
| 💬 **Chat with Documents** | Real-time Server-Sent Events (SSE) streaming chat that synthesizes grounded answers strictly from indexed documents. |
| 📚 **Verifiable Citations** | Clickable inline citation pills (`[[Doc: policy.pdf, Page: 2]]`) that open an interactive slide-over drawer showing exact excerpts and confidence scores. |
| 📝 **Conversation History** | Multi-session conversation management with SQLite persistence (create, rename, switch, and delete chats). |
| 👤 **User Authentication** | Secure JWT authentication with bcrypt password hashing and a **1-Click Guest Demo Mode** for immediate employer testing. |
| 🐳 **Docker Deployment** | Production multi-stage `Dockerfile` and `docker-compose.yml` with health checks and volume persistence. |
| ☁️ **Online Deployment Ready** | Pre-configured for free instant deployment on **Hugging Face Spaces**, **Render**, and **Railway**. |
| ⚙️ **Multi-Model Support** | Pluggable support for **Google Gemini (2.5/1.5 Flash)**, **OpenAI (GPT-4o Mini)**, **Groq (Llama 3.1)**, and a **Built-in Smart Local Synthesizer** (0-cost offline mode). |

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    User([👤 Enterprise User / Employer])
    
    subgraph UI ["Modern Glassmorphic SPA Frontend"]
        ChatTab["💬 Streaming Chat"]
        SearchTab["🔍 Semantic Search Explorer"]
        VaultTab["📄 Knowledge Vault (PDFs)"]
        Drawer["📑 Slide-Over Citation Drawer"]
    end
    
    subgraph Backend ["FastAPI Core Services"]
        AuthSvc["🔐 Auth & JWT Service"]
        PDFProc["📄 PyPDF Extraction & Chunking"]
        EmbSvc["🧠 Hybrid Embedding Engine"]
        VecStore["⚡ Vector Store & BM25 Matcher"]
        GenSvc["🤖 RAG Streaming Generator"]
    end
    
    subgraph Storage ["Persistent Data Layer"]
        DB[(SQLite / SQLAlchemy)]
        Files[("/data/uploads/")]
    end
    
    subgraph Models ["LLM & Embedding Providers"]
        Gemini["Google Gemini 2.5 / 1.5"]
        OpenAI["OpenAI GPT-4o Mini"]
        Groq["Groq Llama 3.1"]
        SmartLocal["Smart Local Synthesizer (No API Key Required)"]
    end

    User --> UI
    UI --> Backend
    Backend --> Storage
    GenSvc --> Models
    EmbSvc --> VecStore
```

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- Python 3.11+
- Git

### 1. Clone & Set Up Environment
```bash
git clone https://github.com/YOUR_USERNAME/enterprise-rag-assistant.git
cd enterprise-rag-assistant

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Generate Demo Enterprise PDFs
```bash
python generate_samples.py
```

### 3. Launch the Application
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser!

---

## 🐳 Docker Deployment

Run the entire application in a production-ready container in one command:

```bash
docker-compose up -d --build
```

Access the app at **`http://localhost:8000`**.

To view logs:
```bash
docker-compose logs -f
```

---

## ☁️ Deploy Online So Employers Can Try It

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for detailed guides on:
1. **Hugging Face Spaces** (Free 16GB RAM Docker hosting with public URL)
2. **Render.com** (Free Docker Web Service)
3. **Railway.app** (1-Click Deploy)

### Employer 5-Second Test Flow:
1. Open the public web link.
2. Click **"1-Click Demo Login"** on the welcome dialog (no email or password required).
3. Click **"Load Demo PDFs"** in the top bar to index sample multi-page corporate compliance & financial reports.
4. Click any sample prompt (e.g. *"What is the Incident Response SLA for P0 events?"*).
5. Click the generated citation badge to inspect the exact quoted page and match confidence!

---

## 🧪 Running Automated Tests

Run the complete automated test suite verifying health, auth, PDF indexing, hybrid search, and streaming chat:

```bash
python test_app.py
```

---

## 📡 API Reference Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new corporate account |
| `POST` | `/api/auth/login` | Sign in with username/email & password |
| `POST` | `/api/auth/guest` | 1-Click instant guest login for evaluators |
| `GET` | `/api/auth/me` | Retrieve authenticated user profile |
| `POST` | `/api/documents/upload` | Upload & index PDF document (multipart/form-data) |
| `GET` | `/api/documents` | List all indexed documents for current user |
| `GET` | `/api/documents/{id}/chunks` | Inspect raw text chunks and embeddings |
| `POST` | `/api/documents/load-samples` | Pre-load enterprise demonstration PDFs |
| `POST` | `/api/search` | Direct hybrid semantic & lexical search |
| `POST` | `/api/chat` | Streaming SSE endpoint for chat with citations |
| `GET` | `/api/conversations` | List conversation sessions |
| `GET` | `/api/settings` | Retrieve active LLM provider and API key status |
| `PUT` | `/api/settings` | Update LLM provider, API credentials, and top-K |

---

## 🛡️ License

This project is open-source under the [MIT License](LICENSE).
