import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import APP_NAME, APP_ENV, DEBUG, BASE_DIR
from app.database import init_db
from app.auth.routes import router as auth_router
from app.routes.documents import router as documents_router
from app.routes.search import router as search_router
from app.routes.chat import router as chat_router
from app.routes.settings import router as settings_router
from app.routes.analytics import router as analytics_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite tables on startup
    init_db()
    # Ensure sample documents directory exists
    sample_dir = BASE_DIR / "sample_documents"
    sample_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title=APP_NAME,
    description="Enterprise Retrieval-Augmented Generation (RAG) Platform with verified citations, hybrid vector search, and multi-tenant isolation.",
    version="1.0.0",
    lifespan=lifespan,
    debug=DEBUG,
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(search_router)
app.include_router(chat_router)
app.include_router(settings_router)
app.include_router(analytics_router)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": APP_NAME,
        "environment": APP_ENV,
        "features": {
            "pdf_processing": True,
            "hybrid_search": True,
            "citations": True,
            "streaming_rag": True,
            "auth": True,
        },
    }


# Static Assets & SPA routing
static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve SPA index.html for all non-API routes."""
    if full_path.startswith("api"):
        return {"error": "API route not found"}
    index_file = static_dir / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": f"Welcome to {APP_NAME}. Static assets are initializing."}
