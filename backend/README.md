# ⚙️ RAG Chatbot Backend System

This directory contains the core backend services for the Retrieval-Augmented Generation (RAG) Chatbot application. The backend is responsible for receiving PDF documents, chunking them, storing vector embeddings, and answering user queries using Large Language Models (LLMs).

## 🛠️ Technologies Used

The backend leverages a modern, high-performance stack for AI and API services:

1. **FastAPI & Uvicorn**: A lightning-fast web framework for building the REST APIs.
2. **LangChain**: Used as the primary orchestration framework for document loading, text splitting, and retrieval pipelines.
3. **ChromaDB**: An open-source vector database used to store and search document embeddings locally.
4. **HuggingFace Embeddings (`BAAI/bge-small-en`)**: Generates vector representations of document chunks for semantic search.
5. **Groq API (`llama-3.1-8b-instant`)**: Extremely fast LLM inference used to generate natural language answers from retrieved context.
6. **PyPDF**: Extracts raw text from uploaded PDF files.

---

## ⚙️ How It Works (Backend Architecture)

### 1. Document Ingestion (`upload.py` & `rag.py`)
- When a PDF is uploaded via the `/upload` endpoint, it's temporarily saved to disk.
- If the document was previously uploaded, the old vectors are deleted to prevent duplicates.
- **PyPDFLoader** extracts the text.
- **RecursiveCharacterTextSplitter** chunks the text with:
  - `chunk_size = 500` characters
  - `chunk_overlap = 50` characters
- **Junk Filtering**: Chunks smaller than 30 characters or containing junk artifacts (like "scanned") are automatically discarded.
- The chunks are then embedded and persisted into a local **ChromaDB** folder (`chroma_db/`).

### 2. Context Retrieval & Generation (`query.py`)
- When a user submits a question via `/query`, the system performs a vector similarity search.
- The **top 6** most relevant chunks (`k=6`) are retrieved from ChromaDB.
- A precise prompt is built combining the user's question and the retrieved context.
- **Groq (LLaMA 3.1)** processes the prompt and returns an answer strictly grounded in the document context.

---

## 🚀 Setup & Execution

### 1. Environment Variables
You need a `.env` file inside this `backend/` directory containing your Groq API key:
```env
GROQ_API_KEY=your_groq_api_key_here
```

### 2. Install Dependencies
Make sure you have your virtual environment activated and run:
```bash
pip install -r requirements.txt
```

### 3. Run the Server
To run the development server locally, execute the following command from within the `backend/` directory:
```bash
uvicorn main:app --reload --port 8000
```
The server will start at `http://localhost:8000`.

---

## 🔌 API Endpoints

### `POST /upload`
Uploads and indexes a PDF document into the vector database.
- **Body**: `multipart/form-data` containing the file under the key `file`.
- **Response**:
```json
{
  "message": "PDF uploaded and indexed successfully",
  "filename": "document.pdf",
  "chunks": 42
}
```

### `GET /files`
Lists all currently uploaded and active PDF files in the system.
- **Response**:
```json
{
  "files": [
    "document.pdf",
    "report_2023.pdf"
  ]
}
```

### `POST /query`
Asks a question against the embedded document context.
- **Body**:
```json
{
  "question": "What is the summary of the report?"
}
```
- **Response**:
```json
{
  "answer": "The report highlights the growth in Q3...",
  "context": "Context retrieved from the database..."
}
```

---

## 📂 File Structure Overview

- `main.py` - FastAPI application configuration and CORS setup.
- `upload.py` - API routing for handling file uploads and listing.
- `query.py` - API routing for the prompt building and Groq LLM invocation.
- `rag.py` - Core logic for text extraction, splitting, filtering, and retrieval.
- `db.py` - ChromaDB client initialization and HuggingFace embeddings setup.
- `models.py` - Pydantic models for request body validation.
