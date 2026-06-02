"""
=============================================================================
File: query.py
Description:
    This module defines the /query API endpoint for the RAG chatbot.
    It ties together the retrieval pipeline and the Groq LLM to produce
    grounded, context-aware answers streamed token-by-token via SSE.

    Key functionalities:
      - POST /query: Accepts a user question + optional chat history,
        retrieves relevant chunks from ChromaDB via retrieve_context(),
        builds a RAG prompt, and streams the LLM response as
        Server-Sent Events (SSE) so the frontend can render text live.
=============================================================================
"""
import os
import json

# FastAPI components.
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

# AsyncGroq for non-blocking streaming inside async FastAPI endpoints.
from groq import AsyncGroq

# Pydantic request model.
from models import QueryRequest

# Retrieval function that fetches the most relevant document chunks.
from rag import retrieve_context

router = APIRouter()

# AsyncGroq client — required for `async for chunk in stream` inside an
# async FastAPI route without blocking the event loop.
client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))

MODEL = "llama-3.1-8b-instant"


@router.post("/query")
async def query_documents(request: QueryRequest):
    """
    Streams the LLM answer back as Server-Sent Events (SSE).

    SSE event types sent to the client:
      {"type": "context", "content": "<retrieved chunks>"}  — sent once first
      {"type": "token",   "content": "<text piece>"}        — one per LLM chunk
      {"type": "error",   "content": "<message>"}           — on failure
    Followed by the sentinel:  data: [DONE]
    """
    question = request.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Retrieve relevant context chunks from ChromaDB.
    context = retrieve_context(question)

    # ── No context found ────────────────────────────────────────────────────
    if not context:
        async def no_context_stream():
            msg = (
                "I couldn't find any relevant information in the uploaded documents "
                "to answer your question. Please upload a relevant PDF first."
            )
            yield f"data: {json.dumps({'type': 'token', 'content': msg})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            no_context_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # ── Build the prompt ─────────────────────────────────────────────────────
    system_message = (
        "You are an intelligent assistant that helps users understand documents. "
        "A relevant excerpt from the document is provided in every user message as 'Context'. "
        "Use that context as your primary source of truth. "
        "Format your response in clean, professional Markdown. Use headings, bold/italic text, "
        "numbered lists, bullet points, code blocks, or tables when appropriate to structure your response. "
        "If the user asks for an opinion, analysis, or recommendation, provide a thoughtful, "
        "well-reasoned response grounded in the context — you are allowed to reason and give views. "
        "If the user's question is a follow-up (e.g. 'give me more', 'elaborate'), "
        "use the conversation history and context to continue in more detail. "
        "Only say you don't know if the context truly contains no relevant information."
    )

    user_message = (
        f"Context (retrieved from uploaded document):\n{context}\n\n"
        f"Question: {question}"
    )

    history = request.chat_history or []
    messages = [{"role": "system", "content": system_message}]
    for turn in history:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": user_message})

    # ── Stream generator ──────────────────────────────────────────────────────
    async def generate():
        # Send retrieved context first so the frontend can build the
        # "View Context Sources" accordion before any tokens arrive.
        yield f"data: {json.dumps({'type': 'context', 'content': context})}\n\n"

        try:
            stream = await client.chat.completions.create(
                messages=messages,
                model=MODEL,
                temperature=0.3,
                max_tokens=1024,
                stream=True,
            )
            async for chunk in stream:
                token = chunk.choices[0].delta.content
                if token:
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        except Exception as e:
            print(f"[Query] Groq streaming error: {type(e).__name__}: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
