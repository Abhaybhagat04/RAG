---
title: RAG
emoji: 👀
colorFrom: purple
colorTo: red
sdk: docker
pinned: false
license: mit
---

# 📄 RAG Chatbot — PDF Question Answering System

A **Retrieval-Augmented Generation (RAG)** application that lets you upload PDF documents and ask natural language questions about their content. The backend uses **FastAPI**, **LangChain**, **ChromaDB**, and **Groq LLM (LLaMA 3.1)**, while the frontend is a clean, interactive web interface served directly from the API server.

---

## 🚀 Features

- 📤 **Upload PDFs** — Upload one or more PDF files via the web interface
- 🔍 **Semantic Search** — Chunks are embedded using `BAAI/bge-small-en` (HuggingFace) and stored in ChromaDB for similarity search
- 🤖 **AI-Powered Answers** — Questions are answered by LLaMA 3.1 (8B Instant) via the Groq API, grounded strictly in the uploaded document context
- 🗂️ **Duplicate Guard** — Re-uploading the same PDF replaces its existing chunks to prevent duplication
- 🧹 **Junk Filtering** — Short, noisy, or scanned-artifact chunks are automatically filtered out before indexing and retrieval
- 🌐 **Integrated Frontend** — A static web UI is served directly by FastAPI at `http://localhost:8000`

---

## 🏗️ Project Structure

```
RAG/
│
├── backend/                    # Backend source code
│   ├── main.py                 # FastAPI app entry point, CORS, static file serving
│   ├── upload.py               # /upload and /files API endpoints
│   ├── query.py                # /query API endpoint (RAG pipeline)
│   ├── rag.py                  # PDF loading, chunking, junk filtering, retrieval
│   ├── db.py                   # ChromaDB + HuggingFace embeddings setup
│   ├── models.py               # Pydantic request models
│   ├── requirements.txt        # Python dependencies
│   ├── .env                    # Environment variables (API keys)
│   └── chroma_db/              # Persisted ChromaDB vector store (auto-created)
│
├── frontend/                   # Frontend web interface
│   ├── index.html              # Main HTML page
│   ├── style.css               # Stylesheet
│   └── app.js                  # Frontend JavaScript logic
│
└── README.md
```

---

## ⚙️ Detailed Technology Stack

This project leverages a modern, high-performance stack for natural language processing and web serving. Here is a detailed breakdown of the technologies used:

### Backend
- **FastAPI**: A modern, fast web framework for building APIs with Python. Chosen for its automatic Swagger documentation, async capabilities, and excellent performance.
- **Uvicorn**: A lightning-fast ASGI server implementation to serve the FastAPI application locally.

### AI & NLP Pipeline (RAG)
- **LangChain**: A framework designed to simplify the creation of applications using large language models. It orchestrates the document loading (`PyPDFLoader`), text chunking (`RecursiveCharacterTextSplitter`), and overall workflow.
- **Groq API (LLaMA 3.1)**: Provides access to ultra-fast inference for large language models. We use **LLaMA 3.1 8B Instant** through Groq for high-speed, accurate, and context-aware natural language generation.
- **HuggingFace Embeddings (`BAAI/bge-small-en`)**: An open-source embedding model that transforms text chunks into dense vector representations. It offers an excellent balance of speed and semantic capture.
- **ChromaDB**: An open-source vector database used to store the embedded document chunks and perform ultra-fast similarity searches to retrieve relevant context.

### Frontend
- **HTML5 & Vanilla CSS**: For a clean, responsive, and visually appealing user interface without the bloat of heavy frameworks.
- **Vanilla JavaScript**: Handles asynchronous API calls (file uploads, user queries), real-time UI updates, and event handling.

### Utilities & Libraries
- **python-dotenv**: Loads environment variables (like the `GROQ_API_KEY`) securely from a `.env` file.
- **python-multipart**: Required by FastAPI to process HTTP form data and file uploads efficiently.
- **pypdf**: A robust pure-Python PDF library used by LangChain to parse and extract text from uploaded PDF documents.
- **sentence-transformers**: Underpins the HuggingFace embeddings generation in Python.


## 🛠️ Setup & Installation

### Prerequisites

- Python 3.9+
- A free [Groq API Key](https://console.groq.com/)

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd RAG
```

### 2. Create and Activate a Virtual Environment

```bash
# Windows
python -m venv myenv
myenv\Scripts\activate

# macOS/Linux
python -m venv myenv
source myenv/bin/activate
```

### 3. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create (or edit) the `backend/.env` file and add your Groq API key:

```env
GROQ_API_KEY=your_groq_api_key_here
```

> ⚠️ **Never commit your `.env` file to version control.** Add it to `.gitignore`.

---

## ▶️ Running the Application

From the `backend/` directory, start the server with:

```bash
uvicorn main:app --reload --port 8000
```

Then open your browser and navigate to:

```
http://localhost:8000
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload a PDF file for indexing |
| `GET` | `/files` | List all uploaded PDF filenames |
| `POST` | `/query` | Ask a question about the uploaded documents |

### Example: Query Request

```json
POST /query
Content-Type: application/json

{
  "question": "What is the main topic of this document?"
}
```

### Example: Query Response

```json
{
  "answer": "The document primarily discusses...",
  "context": "...retrieved chunks from ChromaDB..."
}
```

---

## 🧠 How It Works

```
User uploads PDF
      │
      ▼
PyPDFLoader loads document pages
      │
      ▼
RecursiveCharacterTextSplitter splits into chunks (500 chars, 50 overlap)
      │
      ▼
Junk chunks filtered out (too short / noisy)
      │
      ▼
BAAI/bge-small-en embeds each chunk
      │
      ▼
ChromaDB stores embeddings (persisted locally)
      │
      ▼
User asks a question
      │
      ▼
ChromaDB retrieves top-6 similar chunks
      │
      ▼
Groq LLaMA 3.1 generates answer from context
      │
      ▼
Answer returned to frontend
```

---

## 📦 Dependencies

```
fastapi
uvicorn
langchain
langchain-community
langchain-huggingface
langchain-text-splitters
chromadb
sentence-transformers
pypdf
python-dotenv
groq
python-multipart
```

---

## 🔒 Security Notes

- The `.env` file containing your API key should **never** be pushed to a public repository.
- Add the following to a `.gitignore` file at the project root:

```gitignore
.env
myenv/
__pycache__/
chroma_db/
backend/chroma_db/
*.pdf
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

> Built with ❤️ using FastAPI, LangChain, ChromaDB, and Groq.

