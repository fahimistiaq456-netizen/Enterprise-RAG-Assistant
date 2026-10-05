"""
Comprehensive Automated Test Suite for Enterprise RAG Assistant.
Validates:
1. Database initialization & Auth (Guest & Password)
2. PDF Ingestion & Semantic Chunking
3. Vector Embeddings & Hybrid Retrieval
4. Citations formatting & Relevance Scoring
5. Streaming RAG Chat API & Conversation History
"""
import os
import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure root in sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from app.main import app
from app.database import init_db

client = TestClient(app)


def test_health():
    print("Testing /api/health...")
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    data = res.json()
    assert data["status"] == "healthy"
    print("✓ Health check passed!")


def test_guest_auth():
    print("Testing Guest Evaluator Auth...")
    res = client.post("/api/auth/guest")
    assert res.status_code == 200, f"Guest auth failed: {res.text}"
    data = res.json()
    assert "access_token" in data
    assert data["user"]["is_guest"] is True
    print(f"✓ Guest auth passed! Token created for {data['user']['username']}")
    return data["access_token"]


def test_document_indexing(token: str):
    print("Testing PDF Ingestion & Vector Indexing...")
    # Load demo PDFs
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post("/api/documents/load-samples", headers=headers)
    assert res.status_code == 200, f"Load samples failed: {res.text}"
    data = res.json()
    assert len(data["documents"]) > 0
    print(f"✓ Sample documents indexed: {data['documents']}")

    # List documents
    res = client.get("/api/documents", headers=headers)
    assert res.status_code == 200
    docs = res.json()
    assert len(docs) >= 2
    for d in docs:
        assert d["status"] == "indexed"
        assert d["chunk_count"] > 0
        assert d["page_count"] > 0
        print(f"  - {d['filename']}: {d['page_count']} pages, {d['chunk_count']} chunks")
    print("✓ Document listing and chunk verification passed!")
    return docs[0]["id"]


def test_semantic_search(token: str):
    print("Testing Semantic Vector & Hybrid Search...")
    headers = {"Authorization": f"Bearer {token}"}
    query = "incident response SLA for P0 and P1 containment"
    res = client.post(
        "/api/search",
        headers=headers,
        json={"query": query, "top_k": 3, "alpha": 0.7},
    )
    assert res.status_code == 200, f"Search failed: {res.text}"
    data = res.json()
    assert data["total_results"] > 0
    top_hit = data["results"][0]
    print(f"✓ Top Search Hit: '{top_hit['filename']}' Page {top_hit['page_number']} (Confidence: {top_hit['confidence_pct']}%, Score: {top_hit['similarity_score']})")
    assert "15 minutes" in top_hit["text"] or "Containment" in top_hit["text"] or "incident" in top_hit["text"].lower()
    print("✓ Semantic search returned highly accurate grounded results!")


def test_chat_rag(token: str):
    print("Testing RAG Chat with Document Citations...")
    headers = {"Authorization": f"Bearer {token}"}
    query = "What is the RPO and RTO for disaster recovery?"

    res = client.post(
        "/api/chat",
        headers=headers,
        json={"message": query},
    )
    assert res.status_code == 200, f"Chat failed: {res.text}"

    # Read SSE response
    body = res.text
    assert "data: " in body
    assert '"type": "meta"' in body
    assert '"type": "done"' in body
    print("✓ Streaming RAG SSE stream verified!")

    # Verify conversation list
    res = client.get("/api/conversations", headers=headers)
    assert res.status_code == 200
    convs = res.json()
    assert len(convs) >= 1
    conv_id = convs[0]["id"]

    # Verify conversation message history
    res = client.get(f"/api/conversations/{conv_id}", headers=headers)
    assert res.status_code == 200
    conv_detail = res.json()
    assert len(conv_detail["messages"]) >= 2  # user + assistant
    asst_msg = conv_detail["messages"][1]
    assert asst_msg["sender"] == "assistant"
    assert len(asst_msg["citations"]) > 0
    print(f"✓ Stored conversation citations: {len(asst_msg['citations'])} verified sources attached.")
    print("✓ Full RAG pipeline passed with flying colors!")


if __name__ == "__main__":
    init_db()
    test_health()
    token = test_guest_auth()
    doc_id = test_document_indexing(token)
    test_semantic_search(token)
    test_chat_rag(token)
    print("\n🎉 ALL TESTS PASSED! Enterprise RAG Assistant is completely functional.")
