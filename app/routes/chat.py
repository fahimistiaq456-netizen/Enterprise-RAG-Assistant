import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db, User, Conversation, Message, UserSetting, Document
from app.auth.utils import get_current_user
from app.rag.embeddings import EmbeddingService
from app.rag.vector_store import VectorStore
from app.rag.citations import extract_citations_from_context
from app.rag.generator import RAGGenerator

router = APIRouter(prefix="", tags=["Chat & Conversations"])


class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New Conversation"


class RenameConversationRequest(BaseModel):
    title: str


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    document_ids: Optional[List[int]] = None


@router.get("/api/conversations")
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    convs = (
        db.query(Conversation)
        .filter(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "title": c.title,
            "message_count": len(c.messages),
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }
        for c in convs
    ]


@router.post("/api/conversations")
def create_conversation(
    req: CreateConversationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = Conversation(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title=req.title or "New Conversation",
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {
        "id": conv.id,
        "title": conv.title,
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
    }


@router.get("/api/conversations/{conv_id}")
def get_conversation(conv_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = [
        {
            "id": m.id,
            "sender": m.sender,
            "content": m.content,
            "citations": m.get_citations(),
            "created_at": m.created_at.isoformat(),
        }
        for m in conv.messages
    ]

    return {
        "id": conv.id,
        "title": conv.title,
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
        "messages": messages,
    }


@router.put("/api/conversations/{conv_id}")
def rename_conversation(
    conv_id: str,
    req: RenameConversationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv.title = req.title.strip()
    db.commit()
    return {"id": conv.id, "title": conv.title}


@router.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted"}


@router.post("/api/chat")
async def chat_stream(
    req: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query_text = req.message.strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Get or create conversation
    conv_id = req.conversation_id
    if conv_id:
        conv = (
            db.query(Conversation)
            .filter(Conversation.id == conv_id, Conversation.user_id == user.id)
            .first()
        )
    else:
        conv = None

    if not conv:
        title = query_text[:35] + ("..." if len(query_text) > 35 else "")
        conv = Conversation(
            id=str(uuid.uuid4()),
            user_id=user.id,
            title=title,
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    conv_id = conv.id

    # Save user message
    user_msg = Message(
        conversation_id=conv_id,
        sender="user",
        content=query_text,
    )
    db.add(user_msg)
    db.commit()

    # User settings
    setting = db.query(UserSetting).filter(UserSetting.user_id == user.id).first()
    llm_provider = setting.llm_provider if setting else "smart_local"
    embed_provider = setting.embedding_provider if setting else "local_dense"
    gemini_key = setting.gemini_api_key if setting else ""
    openai_key = setting.openai_api_key if setting else ""
    groq_key = setting.groq_api_key if setting else ""
    top_k = setting.top_k if setting else 4

    # Perform Hybrid Semantic Retrieval
    embedding_service = EmbeddingService(
        provider=embed_provider,
        gemini_key=gemini_key,
        openai_key=openai_key,
    )
    vector_store = VectorStore(db, embedding_service)
    retrieved_chunks = vector_store.search(
        query=query_text,
        user_id=user.id,
        document_ids=req.document_ids,
        top_k=top_k,
    )

    # Extract clean citations
    citations = extract_citations_from_context(retrieved_chunks)

    # Recent history for context
    history_messages = [
        {"sender": m.sender, "content": m.content}
        for m in conv.messages[-6:]
        if m.id != user_msg.id
    ]

    generator = RAGGenerator(
        provider=llm_provider,
        gemini_key=gemini_key,
        openai_key=openai_key,
        groq_key=groq_key,
    )

    async def sse_event_stream():
        from app.database import SessionLocal

        # Send initial metadata event with conversation_id and citations
        init_payload = {
            "type": "meta",
            "conversation_id": conv_id,
            "citations": citations,
        }
        yield f"data: {json.dumps(init_payload)}\n\n"

        full_content = ""
        try:
            async for token in generator.stream_response(query_text, retrieved_chunks, history_messages):
                full_content += token
                event_data = {"type": "token", "content": token}
                yield f"data: {json.dumps(event_data)}\n\n"
        except Exception as e:
            err_msg = f"\n[Error during generation: {str(e)}]"
            full_content += err_msg
            yield f"data: {json.dumps({'type': 'token', 'content': err_msg})}\n\n"

        # End event
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

        # Save assistant message into DB using a dedicated session
        local_db = SessionLocal()
        try:
            asst_msg = Message(
                conversation_id=conv_id,
                sender="assistant",
                content=full_content,
            )
            asst_msg.set_citations(citations)
            local_db.add(asst_msg)
            # Update conversation timestamp
            local_conv = local_db.query(Conversation).filter(Conversation.id == conv_id).first()
            if local_conv:
                # If first exchange, ensure good title
                if local_conv.title == "New Conversation":
                    local_conv.title = query_text[:35] + ("..." if len(query_text) > 35 else "")
            local_db.commit()
        except Exception as e:
            print(f"[Error saving message]: {e}")
        finally:
            local_db.close()

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
