import re
from pathlib import Path
from typing import List, Dict, Any, Tuple
from pypdf import PdfReader


class PDFProcessingError(Exception):
    pass


class PDFProcessor:
    def __init__(self, chunk_size: int = 700, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def extract_text_by_pages(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract text from a PDF file preserving page numbers (1-indexed)."""
        if not file_path.exists():
            raise PDFProcessingError(f"PDF file not found at: {file_path}")

        try:
            reader = PdfReader(str(file_path))
        except Exception as e:
            raise PDFProcessingError(f"Failed to read PDF file: {str(e)}")

        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                raise PDFProcessingError("PDF is password protected and cannot be read.")

        pages_data = []
        total_pages = len(reader.pages)

        for page_idx, page in enumerate(reader.pages):
            page_num = page_idx + 1
            try:
                raw_text = page.extract_text() or ""
            except Exception:
                raw_text = ""

            cleaned_text = self._clean_text(raw_text)
            pages_data.append({
                "page_number": page_num,
                "text": cleaned_text,
                "char_count": len(cleaned_text),
            })

        return pages_data

    def chunk_document(self, pages_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Split extracted pages into overlapping chunks while preserving page numbers.
        Returns a list of chunk dictionaries with metadata.
        """
        chunks: List[Dict[str, Any]] = []
        global_chunk_idx = 0

        for page_info in pages_data:
            page_num = page_info["page_number"]
            page_text = page_info["text"]

            if not page_text.strip():
                continue

            page_chunks = self._chunk_page_text(page_text, page_num)
            for ch in page_chunks:
                ch["chunk_index"] = global_chunk_idx
                chunks.append(ch)
                global_chunk_idx += 1

        return chunks

    def _clean_text(self, text: str) -> str:
        """Clean extracted PDF text: normalize whitespace and remove control characters."""
        if not text:
            return ""
        # Replace multiple spaces with a single space
        text = re.sub(r"[ \t]+", " ", text)
        # Normalize excessive newlines to maximum 2
        text = re.sub(r"\n{3,}", "\n\n", text)
        # Strip leading/trailing whitespaces
        return text.strip()

    def _chunk_page_text(self, text: str, page_number: int) -> List[Dict[str, Any]]:
        """Chunk a single page's text with overlap."""
        chunks = []
        text_len = len(text)

        if text_len <= self.chunk_size:
            return [{
                "page_number": page_number,
                "text": text,
                "token_count": len(text.split()),
                "char_length": text_len,
            }]

        # Split along paragraph or sentence boundaries
        paragraphs = text.split("\n\n")
        current_chunk = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # If adding this paragraph exceeds chunk size, split or emit
            if len(current_chunk) + len(para) + 2 <= self.chunk_size:
                if current_chunk:
                    current_chunk += "\n\n" + para
                else:
                    current_chunk = para
            else:
                if current_chunk:
                    chunks.append({
                        "page_number": page_number,
                        "text": current_chunk,
                        "token_count": len(current_chunk.split()),
                        "char_length": len(current_chunk),
                    })
                    # Overlap: keep last part
                    overlap_len = min(len(current_chunk), self.chunk_overlap)
                    overlap_text = current_chunk[-overlap_len:]
                    current_chunk = overlap_text + "\n" + para
                else:
                    # Single paragraph is larger than chunk_size, split by sentences/fixed stride
                    sub_chunks = self._split_large_text(para, page_number)
                    chunks.extend(sub_chunks)
                    current_chunk = ""

        if current_chunk.strip():
            chunks.append({
                "page_number": page_number,
                "text": current_chunk.strip(),
                "token_count": len(current_chunk.split()),
                "char_length": len(current_chunk.strip()),
            })

        return chunks

    def _split_large_text(self, text: str, page_number: int) -> List[Dict[str, Any]]:
        """Split a large block of text by sliding window with overlap."""
        chunks = []
        start = 0
        step = max(self.chunk_size - self.chunk_overlap, 100)

        while start < len(text):
            end = min(start + self.chunk_size, len(text))
            chunk_slice = text[start:end].strip()
            if chunk_slice:
                chunks.append({
                    "page_number": page_number,
                    "text": chunk_slice,
                    "token_count": len(chunk_slice.split()),
                    "char_length": len(chunk_slice),
                })
            start += step

        return chunks
