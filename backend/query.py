"""
=============================================================================
File: query.py
Description:
    This module defines the /query API endpoint for the RAG chatbot.
    It ties together the retrieval pipeline and the Groq LLM to produce
    grounded, context-aware answers.

    Key functionalities:
      - POST /query: Accepts a user question, retrieves the most relevant
        document chunks from ChromaDB via retrieve_context(), builds a
        RAG prompt, calls the Groq LLM (llama3-8b-8192), and streams or
        returns the generated answer.
=============================================================================
"""
# Import os to read environment variables (e.g., GROQ_API_KEY).
import os

# Import FastAPI components.
# APIRouter lets us define routes in a separate file and attach them to the main app.
# HTTPException lets us return standard HTTP error responses.
from fastapi import APIRouter, HTTPException

# Import the Groq client to interact with the Groq-hosted LLM API.
from groq import Groq

# Import the Pydantic model that validates the incoming request body.
from models import QueryRequest

# Import the retrieval function that fetches the most relevant document chunks.
from rag import retrieve_context

# Create the router instance. main.py imports this as `query_router`.
router = APIRouter()

# Initialize the Groq client.
# Why here? main.py loads .env BEFORE importing this module, so GROQ_API_KEY
# is guaranteed to be in the environment by the time this line runs.
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# The LLM model to use. llama-3.1-8b-instant is fast, capable, and free-tier friendly on Groq.
MODEL = "llama-3.1-8b-instant"


@router.post("/query")
async def query_documents(request: QueryRequest):
    """
    Accepts a user question, retrieves relevant context from the vector DB,
    and returns an LLM-generated answer grounded in that context.
    """
    question = request.question.strip()

    # Guard: reject empty questions early.
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Stage 1 & 2: Retrieve and re-rank the most relevant document chunks.
    context = retrieve_context(question)

    # If no relevant context was found, inform the user instead of hallucinating.
    if not context:
        return {
            "answer": (
                "I couldn't find any relevant information in the uploaded documents "
                "to answer your question. Please try uploading a relevant PDF first."
            )
        }

    # Build the RAG prompt.
    # Why separate system and user messages? This is the standard chat format for
    # instruction-tuned models. The system message sets the assistant's persona and
    # constraints; the user message contains the actual question + context.
    system_message = (
        "You are a helpful assistant. Answer the user's question using ONLY the "
        "context provided below. If the answer is not contained in the context, "
        "say 'I don't have enough information to answer that based on the provided documents.' "
        "Do not make up information."
    )

    user_message = (
        f"Context:\n{context}\n\n"
        f"Question: {question}"
    )

    # Call the Groq LLM.
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user",   "content": user_message},
            ],
            model=MODEL,
            temperature=0.2,   # Low temperature = more factual, less creative.
            max_tokens=1024,
        )
    except Exception as e:
        # Print the real Groq error to the terminal for easy debugging.
        print(f"[Query] Groq API error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"LLM request failed: {str(e)}"
        )

    # Extract the generated text from the response object.
    answer = chat_completion.choices[0].message.content

    return {"answer": answer}
