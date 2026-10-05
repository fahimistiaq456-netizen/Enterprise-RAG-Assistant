import os
import shutil
import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.config import UPLOAD_DIR, BASE_DIR, CHUNK_SIZE, CHUNK_OVERLAP
from app.database import get_db, User, Document, DocumentChunk, UserSetting
from app.auth.utils import get_current_user
from app.rag.pdf_processor import PDFProcessor, PDFProcessingError
from app.rag.embeddings import EmbeddingService

router = APIRouter(prefix="/api/documents", tags=["Documents"])


def get_user_upload_dir(user_id: int) -> Path:
    user_dir = UPLOAD_DIR / f"user_{user_id}"
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


def process_and_index_document(doc_id: int, file_path: Path, user_id: int):
    """Background or inline document processing and embedding calculation."""
    from app.database import SessionLocal

    db: Session = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return

        user_setting = db.query(UserSetting).filter(UserSetting.user_id == user_id).first()
        embed_provider = user_setting.embedding_provider if user_setting else "local_dense"
        gemini_key = user_setting.gemini_api_key if user_setting else ""
        openai_key = user_setting.openai_api_key if user_setting else ""

        processor = PDFProcessor(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
        pages_data = processor.extract_text_by_pages(file_path)
        chunks_data = processor.chunk_document(pages_data)

        if not chunks_data:
            doc.status = "failed"
            doc.error_message = "No readable text could be extracted from this PDF."
            db.commit()
            return

        doc.page_count = len(pages_data)
        doc.chunk_count = len(chunks_data)

        # Batch embed chunk texts
        embedding_service = EmbeddingService(
            provider=embed_provider,
            gemini_key=gemini_key,
            openai_key=openai_key,
        )
        texts_to_embed = [ch["text"] for ch in chunks_data]
        embeddings = embedding_service.embed_texts(texts_to_embed)

        # Save chunks into DB
        for idx, ch in enumerate(chunks_data):
            emb = embeddings[idx] if idx < len(embeddings) else None
            db_chunk = DocumentChunk(
                document_id=doc.id,
                user_id=user_id,
                chunk_index=ch["chunk_index"],
                page_number=ch["page_number"],
                text_content=ch["text"],
                token_count=ch["token_count"],
            )
            db_chunk.set_embedding(emb)
            db.add(db_chunk)

        doc.status = "indexed"
        doc.error_message = None
        db.commit()
    except Exception as e:
        db.rollback()
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = "failed"
            doc.error_message = str(e)
            db.commit()
    finally:
        db.close()


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF documents (.pdf) are supported.",
        )

    # Check for duplicate filename for this user
    existing_doc = db.query(Document).filter(
        Document.user_id == user.id,
        Document.filename == file.filename,
    ).first()

    if existing_doc:
        # Append unique prefix to avoid accidental overwrites
        unique_name = f"{uuid.uuid4().hex[:4]}_{file.filename}"
    else:
        unique_name = file.filename

    user_dir = get_user_upload_dir(user.id)
    save_path = user_dir / f"{uuid.uuid4().hex}_{unique_name}"

    content = await file.read()
    file_size = len(content)

    if file_size > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum allowed limit (50MB).",
        )

    with open(save_path, "wb") as f:
        f.write(content)

    doc = Document(
        user_id=user.id,
        filename=unique_name,
        storage_path=str(save_path),
        file_size=file_size,
        status="processing",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Run processing directly or in background
    process_and_index_document(doc.id, save_path, user.id)

    db.refresh(doc)
    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_size": doc.file_size,
        "page_count": doc.page_count,
        "chunk_count": doc.chunk_count,
        "status": doc.status,
        "error_message": doc.error_message,
        "created_at": doc.created_at.isoformat(),
    }


@router.get("")
def list_documents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.user_id == user.id).order_by(Document.created_at.desc()).all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "file_size": d.file_size,
            "page_count": d.page_count,
            "chunk_count": d.chunk_count,
            "status": d.status,
            "error_message": d.error_message,
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


@router.get("/{doc_id}")
def get_document(doc_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_size": doc.file_size,
        "page_count": doc.page_count,
        "chunk_count": doc.chunk_count,
        "status": doc.status,
        "error_message": doc.error_message,
        "created_at": doc.created_at.isoformat(),
    }


@router.get("/{doc_id}/chunks")
def get_document_chunks(doc_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id == doc_id)
        .order_by(DocumentChunk.chunk_index)
        .all()
    )

    return [
        {
            "id": ch.id,
            "chunk_index": ch.chunk_index,
            "page_number": ch.page_number,
            "text": ch.text_content,
            "token_count": ch.token_count,
            "has_embedding": bool(ch.embedding_json),
        }
        for ch in chunks
    ]


@router.delete("/{doc_id}")
def delete_document(doc_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove file from disk
    if os.path.exists(doc.storage_path):
        try:
            os.remove(doc.storage_path)
        except Exception:
            pass

    db.delete(doc)
    db.commit()
    return {"message": f"Document '{doc.filename}' deleted successfully"}


@router.post("/load-samples")
def load_sample_documents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Load realistic pre-packaged enterprise demo documents for immediate testing."""
    sample_dir = BASE_DIR / "sample_documents"
    if not sample_dir.exists():
        raise HTTPException(status_code=404, detail="Sample documents directory not found.")

    pdf_files = list(sample_dir.glob("*.pdf"))
    if not pdf_files:
        raise HTTPException(status_code=404, detail="No sample PDF documents found.")

    user_dir = get_user_upload_dir(user.id)
    loaded_docs = []

    for pdf_path in pdf_files:
        # Check if already loaded
        existing = db.query(Document).filter(
            Document.user_id == user.id,
            Document.filename == pdf_path.name,
        ).first()

        if existing:
            loaded_docs.append(existing.filename)
            continue

        target_path = user_dir / f"{uuid.uuid4().hex[:8]}_{pdf_path.name}"
        shutil.copy2(pdf_path, target_path)

        doc = Document(
            user_id=user.id,
            filename=pdf_path.name,
            storage_path=str(target_path),
            file_size=target_path.stat().st_size,
            status="processing",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        process_and_index_document(doc.id, target_path, user.id)
        loaded_docs.append(pdf_path.name)

    return {"message": "Sample enterprise documents loaded successfully", "documents": loaded_docs}
