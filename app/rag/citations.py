import re
from typing import List, Dict, Any


def extract_citations_from_context(
    retrieved_chunks: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Build structured citation items from retrieved context chunks.
    Ensures every cited source has verifiable page numbers, doc names, and excerpts.
    """
    citations = []
    seen = set()

    for idx, chunk in enumerate(retrieved_chunks):
        key = (chunk["filename"], chunk["page_number"])
        if key in seen:
            continue
        seen.add(key)

        # Extract representative excerpt (first 250 characters or leading sentences)
        text = chunk["text"].strip()
        sentences = re.split(r"(?<=[.!?])\s+", text)
        excerpt = " ".join(sentences[:2]) if len(sentences) >= 2 else text[:250]
        if len(text) > len(excerpt):
            excerpt += "..."

        confidence_pct = int(min(max(chunk["similarity_score"] * 100, 50), 99))

        citations.append({
            "citation_id": f"cit-{idx+1}",
            "filename": chunk["filename"],
            "page_number": chunk["page_number"],
            "chunk_id": chunk["chunk_id"],
            "excerpt": excerpt,
            "confidence_pct": confidence_pct,
            "similarity_score": chunk["similarity_score"],
        })

    return citations


def format_context_for_prompt(retrieved_chunks: List[Dict[str, Any]]) -> str:
    """Format chunks into a clean, numbered context block for LLM prompt."""
    if not retrieved_chunks:
        return "No relevant documents found."

    context_parts = []
    for i, chunk in enumerate(retrieved_chunks):
        part = (
            f"[Source {i+1}]: {chunk['filename']} (Page {chunk['page_number']})\n"
            f"Content: {chunk['text']}\n"
        )
        context_parts.append(part)

    return "\n---\n".join(context_parts)
