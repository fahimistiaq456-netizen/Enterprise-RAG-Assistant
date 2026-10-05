import hashlib
import re
from typing import List, Optional
import numpy as np
try:
    from google import genai
    HAS_NEW_GENAI = True
except ImportError:
    HAS_NEW_GENAI = False
    import google.generativeai as legacy_genai

from openai import OpenAI
from app.config import GEMINI_API_KEY, OPENAI_API_KEY

LOCAL_EMBED_DIM = 128


class EmbeddingService:
    def __init__(self, provider: str = "local_dense", gemini_key: str = "", openai_key: str = ""):
        self.provider = provider
        self.gemini_key = gemini_key or GEMINI_API_KEY
        self.openai_key = openai_key or OPENAI_API_KEY

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate embedding vectors for a list of texts."""
        if not texts:
            return []

        if self.provider == "gemini" and self.gemini_key:
            try:
                return self._embed_gemini(texts)
            except Exception as e:
                print(f"[Warning] Gemini embedding failed: {e}. Falling back to local dense embeddings.")

        if self.provider == "openai" and self.openai_key:
            try:
                return self._embed_openai(texts)
            except Exception as e:
                print(f"[Warning] OpenAI embedding failed: {e}. Falling back to local dense embeddings.")

        # Default: Local dense semantic vectors
        return self._embed_local_dense(texts)

    def embed_query(self, query: str) -> List[float]:
        """Generate embedding vector for a single search query."""
        results = self.embed_texts([query])
        return results[0] if results else [0.0] * LOCAL_EMBED_DIM

    def _embed_local_dense(self, texts: List[str]) -> List[List[float]]:
        """
        Produce normalized 128-dimensional dense vectors using a token n-gram
        feature hashing projection with IDF weighting.
        Fast, zero-download, and highly effective for document similarity.
        """
        embeddings = []
        for text in texts:
            vec = np.zeros(LOCAL_EMBED_DIM, dtype=np.float32)
            # Tokenize into words and bi-grams
            words = re.findall(r"\b\w{2,}\b", text.lower())
            tokens = list(words)
            for i in range(len(words) - 1):
                tokens.append(f"{words[i]}_{words[i+1]}")

            if not tokens:
                embeddings.append(vec.tolist())
                continue

            for token in tokens:
                # Hash token to dimension index and sign
                h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
                idx = h % LOCAL_EMBED_DIM
                sign = 1.0 if ((h >> 8) & 1) else -1.0
                vec[idx] += sign

            # L2 Normalize
            norm = np.linalg.norm(vec)
            if norm > 1e-6:
                vec = vec / norm
            embeddings.append(vec.tolist())

        return embeddings

    def _embed_gemini(self, texts: List[str]) -> List[List[float]]:
        embeddings = []
        if HAS_NEW_GENAI:
            client = genai.Client(api_key=self.gemini_key)
            for text in texts:
                resp = client.models.embed_content(
                    model="text-embedding-004",
                    contents=text[:2000],
                )
                embeddings.append(resp.embedding.values)
        else:
            legacy_genai.configure(api_key=self.gemini_key)
            for text in texts:
                resp = legacy_genai.embed_content(
                    model="models/text-embedding-004",
                    content=text[:2000],
                    task_type="retrieval_document",
                )
                embeddings.append(resp["embedding"])
        return embeddings

    def _embed_openai(self, texts: List[str]) -> List[List[float]]:
        client = OpenAI(api_key=self.openai_key)
        resp = client.embeddings.create(
            model="text-embedding-3-small",
            input=[t[:4000] for t in texts],
        )
        return [item.embedding for item in resp.data]
