import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db, User, UserSetting
from app.auth.utils import get_current_user
from app.rag.embeddings import EmbeddingService
from app.rag.vector_store import VectorStore

router = APIRouter(prefix="/api/search", tags=["Search"])


class SearchRequest(BaseModel):
    query: str
    document_ids: Optional[List[int]] = None
    top_k: int = 5
    alpha: float = 0.7  # 0.7 dense vector + 0.3 lexical BM25


class SearchResultItem(BaseModel):
    chunk_id: int
    document_id: int
    filename: str
    page_number: int
    text: str
    similarity_score: float
    confidence_pct: int
    dense_score: float
    lexical_score: float


class SearchResponse(BaseModel):
    query: str
    total_results: int
    execution_time_ms: float
    results: List[SearchResultItem]


@router.post("", response_model=SearchResponse)
def semantic_search(
    req: SearchRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = req.query.strip()
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query cannot be empty",
        )

    start_time = time.perf_counter()

    # User settings
    setting = db.query(UserSetting).filter(UserSetting.user_id == user.id).first()
    embed_provider = setting.embedding_provider if setting else "local_dense"
    gemini_key = setting.gemini_api_key if setting else ""
    openai_key = setting.openai_api_key if setting else ""

    embedding_service = EmbeddingService(
        provider=embed_provider,
        gemini_key=gemini_key,
        openai_key=openai_key,
    )
    vector_store = VectorStore(db, embedding_service)

    raw_results = vector_store.search(
        query=query,
        user_id=user.id,
        document_ids=req.document_ids,
        top_k=req.top_k,
        alpha=req.alpha,
    )

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

    results = []
    for r in raw_results:
        conf = int(min(max(r["similarity_score"] * 100, 30), 99))
        results.append(
            SearchResultItem(
                chunk_id=r["chunk_id"],
                document_id=r["document_id"],
                filename=r["filename"],
                page_number=r["page_number"],
                text=r["text"],
                similarity_score=r["similarity_score"],
                confidence_pct=conf,
                dense_score=r["dense_score"],
                lexical_score=r["lexical_score"],
            )
        )

    return SearchResponse(
        query=query,
        total_results=len(results),
        execution_time_ms=elapsed_ms,
        results=results,
    )
