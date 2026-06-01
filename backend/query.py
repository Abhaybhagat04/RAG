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
    # The system message sets the assistant's persona:
    #   - Ground answers in the provided context.
    #   - For analytical/opinion questions (e.g. "should I hire this person?"),
    #     the model IS allowed to reason and give views — but must base them on
    #     the document. This prevents both hallucination AND over-refusal.
    system_message = (
        "You are an intelligent assistant that helps users understand documents. "
        "A relevant excerpt from the document is provided in every user message as 'Context'. "
        "Use that context as your primary source of truth. "
        "If the user asks for an opinion, analysis, or recommendation (e.g. 'should I hire this person?', "
        "'what do you think?'), provide a thoughtful, well-reasoned response grounded in the context — "
        "you are allowed to reason and give views based on the document content. "
        "If the user's question is a follow-up (e.g. 'give me more', 'tell me more', 'elaborate'), "
        "use the conversation history and the context to continue your previous answer in more detail. "
        "Only say you don't know if the context truly contains no relevant information at all."
    )

    # The final user turn: inject the retrieved context + the actual question.
    user_message = (
        f"Context (retrieved from uploaded document):\n{context}\n\n"
        f"Question: {question}"
    )

    # Build the full message list:
    # [system] + [prior chat turns] + [current user turn with context]
    # This lets the LLM understand follow-up messages like "give me more".
    history = request.chat_history or []
    messages = [{"role": "system", "content": system_message}]
    for turn in history:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": user_message})

    # Call the Groq LLM.
    try:
        chat_completion = client.chat.completions.create(
            messages=messages,
            model=MODEL,
            temperature=0.3,   # Slightly higher for richer analytical answers.
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
