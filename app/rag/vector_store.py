import re
import math
import numpy as np
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database import DocumentChunk, Document
from app.rag.embeddings import EmbeddingService


def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 < 1e-6 or n2 < 1e-6:
        return 0.0
    return float(np.dot(v1, v2) / (n1 * n2))


class VectorStore:
    def __init__(self, db: Session, embedding_service: EmbeddingService):
        self.db = db
        self.embedding_service = embedding_service

    def search(
        self,
        query: str,
        user_id: int,
        document_ids: Optional[List[int]] = None,
        top_k: int = 4,
        alpha: float = 0.7,
    ) -> List[Dict[str, Any]]:
        """
        Hybrid search combining dense vector cosine similarity and keyword BM25 scoring.
        alpha: weight for dense vector search (0.7 dense + 0.3 lexical).
        """
        # Fetch candidate chunks for user
        query_db = (
            self.db.query(DocumentChunk, Document.filename)
            .join(Document, DocumentChunk.document_id == Document.id)
            .filter(DocumentChunk.user_id == user_id)
            .filter(Document.status == "indexed")
        )

        if document_ids:
            query_db = query_db.filter(DocumentChunk.document_id.in_(document_ids))

        chunks_with_filename = query_db.all()
        if not chunks_with_filename:
            return []

        # Generate query embedding
        query_vec = np.array(self.embedding_service.embed_query(query), dtype=np.float32)

        # Tokenize query for lexical scoring
        query_words = set(re.findall(r"\b\w{2,}\b", query.lower()))

        scored_results = []
        for chunk, filename in chunks_with_filename:
            chunk_embedding = chunk.get_embedding()
            if not chunk_embedding:
                dense_score = 0.0
            else:
                chunk_vec = np.array(chunk_embedding, dtype=np.float32)
                # Ensure dimension match if provider changed
                if len(chunk_vec) == len(query_vec):
                    dense_score = max(0.0, cosine_similarity(query_vec, chunk_vec))
                else:
                    dense_score = 0.0

            # Lexical BM25 / Keyword overlap score
            lexical_score = self._compute_lexical_score(query_words, chunk.text_content)

            # Combined hybrid score
            hybrid_score = (alpha * dense_score) + ((1.0 - alpha) * lexical_score)

            scored_results.append({
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "filename": filename,
                "page_number": chunk.page_number,
                "text": chunk.text_content,
                "token_count": chunk.token_count,
                "similarity_score": round(float(hybrid_score), 4),
                "dense_score": round(float(dense_score), 4),
                "lexical_score": round(float(lexical_score), 4),
            })

        # Sort descending by hybrid score
        scored_results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return scored_results[:top_k]

    def _compute_lexical_score(self, query_words: set, text: str) -> float:
        """Lightweight BM25-inspired lexical matching."""
        if not query_words or not text:
            return 0.0

        text_lower = text.lower()
        text_words = re.findall(r"\b\w{2,}\b", text_lower)
        if not text_words:
            return 0.0

        doc_len = len(text_words)
        avg_len = 100.0
        k1 = 1.5
        b = 0.75

        score = 0.0
        for word in query_words:
            tf = text_words.count(word)
            if tf > 0:
                # Term saturation
                term_score = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc_len / avg_len)))
                # Phrase bonus if exact query sequence exists
                if word in text_lower:
                    term_score += 0.2
                score += term_score

        # Normalize score into [0, 1] range using sigmoid-like squash
        normalized = 1.0 - math.exp(-0.5 * score)
        return min(max(normalized, 0.0), 1.0)
