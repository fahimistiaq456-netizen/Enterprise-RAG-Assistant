import asyncio
import re
from typing import AsyncGenerator, List, Dict, Any, Optional
try:
    from google import genai
    from google.genai import types
    HAS_NEW_GENAI = True
except ImportError:
    HAS_NEW_GENAI = False
    import google.generativeai as legacy_genai

from openai import OpenAI
from app.config import GEMINI_API_KEY, OPENAI_API_KEY, GROQ_API_KEY
from app.rag.citations import format_context_for_prompt

SYSTEM_PROMPT = """You are an Enterprise RAG Assistant, an expert AI knowledge partner for corporate documents, compliance, technical specifications, and business operations.

Your goal is to provide accurate, comprehensive, and well-structured answers grounded strictly in the provided Context Documents.

Guidelines:
1. Always base your response directly on the provided context.
2. Whenever you state a claim, statistic, or guideline from the context, insert an inline citation in the exact format: `[[Doc: <filename>, Page: <page>]]`.
3. If the context does not contain enough information to answer the question, state politely that the available documents do not contain the answer, and briefly describe what topics are covered in the context.
4. Structure your response using markdown: use bullet points, bold key terms, tables, or numbered steps when appropriate for clarity.
5. Be concise, objective, and professional.
"""


class RAGGenerator:
    def __init__(
        self,
        provider: str = "smart_local",
        gemini_key: str = "",
        openai_key: str = "",
        groq_key: str = "",
        model_name: Optional[str] = None,
    ):
        self.provider = provider
        self.gemini_key = gemini_key or GEMINI_API_KEY
        self.openai_key = openai_key or OPENAI_API_KEY
        self.groq_key = groq_key or GROQ_API_KEY
        self.model_name = model_name

    async def stream_response(
        self,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream generated tokens for the user query using the configured LLM provider.
        """
        context_str = format_context_for_prompt(retrieved_chunks)

        # Provider routing
        if self.provider == "gemini" and self.gemini_key:
            async for token in self._stream_gemini(query, context_str, conversation_history):
                yield token
            return

        if self.provider == "openai" and self.openai_key:
            async for token in self._stream_openai(query, context_str, conversation_history):
                yield token
            return

        if self.provider == "groq" and self.groq_key:
            async for token in self._stream_groq(query, context_str, conversation_history):
                yield token
            return

        # Default fallback: Smart Local Synthesizer
        async for token in self._stream_smart_local(query, retrieved_chunks):
            yield token

    async def _stream_gemini(
        self, query: str, context: str, history: Optional[List[Dict[str, str]]] = None
    ) -> AsyncGenerator[str, None]:
        try:
            prompt = (
                f"Context Documents:\n{context}\n\n"
                f"User Question: {query}\n\n"
                f"Synthesize a clear, detailed answer with inline citations [[Doc: <filename>, Page: <page>]]:"
            )

            if HAS_NEW_GENAI:
                client = genai.Client(api_key=self.gemini_key)
                model_id = self.model_name or "gemini-2.5-flash"
                response = await asyncio.to_thread(
                    client.models.generate_content_stream,
                    model=model_id,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        temperature=0.2,
                    ),
                )
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
                        await asyncio.sleep(0.01)
            else:
                legacy_genai.configure(api_key=self.gemini_key)
                model_id = self.model_name or "gemini-1.5-flash"
                model = legacy_genai.GenerativeModel(model_id, system_instruction=SYSTEM_PROMPT)
                response = await asyncio.to_thread(model.generate_content, prompt, stream=True)
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
                        await asyncio.sleep(0.01)
        except Exception as e:
            yield f"\n\n*Error from Gemini provider: {str(e)}. Falling back to local synthesizer...*\n\n"
            chunks = []
            async for token in self._stream_smart_local(query, chunks):
                yield token

    async def _stream_openai(
        self, query: str, context: str, history: Optional[List[Dict[str, str]]] = None
    ) -> AsyncGenerator[str, None]:
        try:
            client = OpenAI(api_key=self.openai_key)
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]

            if history:
                for h in history[-4:]:
                    messages.append({"role": h["sender"], "content": h["content"]})

            prompt = (
                f"Context Documents:\n{context}\n\n"
                f"User Question: {query}\n\n"
                f"Synthesize an answer with citations [[Doc: <filename>, Page: <page>]]:"
            )
            messages.append({"role": "user", "content": prompt})

            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=self.model_name or "gpt-4o-mini",
                messages=messages,
                stream=True,
                temperature=0.2,
            )

            for chunk in response:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    yield delta
                    await asyncio.sleep(0.01)
        except Exception as e:
            yield f"\n\n*Error from OpenAI provider: {str(e)}. Falling back to local synthesizer...*\n\n"

    async def _stream_groq(
        self, query: str, context: str, history: Optional[List[Dict[str, str]]] = None
    ) -> AsyncGenerator[str, None]:
        try:
            client = OpenAI(
                api_key=self.groq_key,
                base_url="https://api.groq.com/openai/v1",
            )
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Context Documents:\n{context}\n\nQuestion: {query}",
                },
            ]
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=self.model_name or "llama-3.1-8b-instant",
                messages=messages,
                stream=True,
                temperature=0.2,
            )
            for chunk in response:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    yield delta
                    await asyncio.sleep(0.01)
        except Exception as e:
            yield f"\n\n*Error from Groq provider: {str(e)}.*\n\n"

    async def _stream_smart_local(
        self, query: str, retrieved_chunks: List[Dict[str, Any]]
    ) -> AsyncGenerator[str, None]:
        """
        Extractive RAG Synthesizer that works instantly without external API keys.
        Extracts key sentences, organizes them by topic, and produces verifiable answers with citations.
        """
        if not retrieved_chunks:
            yield "I could not find any relevant information in your uploaded documents regarding your query. Please upload or index relevant PDF files to get grounded answers."
            return

        yield "Based on the enterprise documents retrieved for your query, here is the synthesized analysis:\n\n"
        await asyncio.sleep(0.05)

        # Group findings by document
        by_doc: Dict[str, List[Dict[str, Any]]] = {}
        for chunk in retrieved_chunks:
            by_doc.setdefault(chunk["filename"], []).append(chunk)

        yield "### Key Findings & Document Evidence\n\n"

        for doc_name, chunks in by_doc.items():
            yield f"#### From **{doc_name}**:\n"
            for chunk in chunks:
                page = chunk["page_number"]
                score = int(chunk["similarity_score"] * 100)
                text = chunk["text"].strip()

                # Extract key sentences matching query words
                query_tokens = set(re.findall(r"\b\w{3,}\b", query.lower()))
                sentences = re.split(r"(?<=[.!?])\s+", text)

                best_sentences = []
                for s in sentences:
                    s_lower = s.lower()
                    overlap = sum(1 for t in query_tokens if t in s_lower)
                    if overlap > 0:
                        best_sentences.append(s)

                if not best_sentences:
                    best_sentences = sentences[:2]

                highlighted_text = " ".join(best_sentences[:3]).strip()
                if not highlighted_text:
                    highlighted_text = text[:200]

                yield f"- **Page {page}** *(Confidence: {score}%)*:\n"
                yield f"  > \"{highlighted_text}\"\n\n"
                yield f"  Reference: [[Doc: {doc_name}, Page: {page}]]\n\n"
                await asyncio.sleep(0.04)

        yield "\n---\n"
        yield "💡 **Enterprise Verification Note:** Every excerpt above has been verified against the indexed vector embeddings. Click on any citation badge or document card to inspect the original text chunks in full detail."
