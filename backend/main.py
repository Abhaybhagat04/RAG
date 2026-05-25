"""
=============================================================================
File: main.py
Description: 
    This is the main entry point for the FastAPI backend application.
    It orchestrates the entire RAG (Retrieval-Augmented Generation) system by:
      1. Loading environment variables (like GROQ_API_KEY).
      2. Initializing the FastAPI server instance.
      3. Configuring CORS to allow cross-origin requests.
      4. Registering the API routing for file uploads (/upload, /files) and 
         document querying (/query).
      5. Mounting and serving the static frontend files so the entire 
         application can be accessed from a single port (8000).
=============================================================================
"""
# Import OS and Sys modules for interacting with the operating system and Python environment paths.
import os
import sys

# Import load_dotenv to securely load secret API keys from a hidden .env file into memory.
from dotenv import load_dotenv

# Prepend the directory containing this file to sys.path to resolve imports cleanly.
# Why? When you run Python scripts, sometimes it gets confused about where to import local files from. This forces Python to look in the current folder first.
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Load environment variables from .env BEFORE importing any other custom modules (like query.py).
# Why? Because query.py initializes the Groq client immediately upon being imported, so the GROQ_API_KEY must be available in the OS environment beforehand.
load_dotenv(os.path.join(current_dir, ".env"))

# Import the core FastAPI framework class to create our web server.
from fastapi import FastAPI

# Import CORSMiddleware. 
# Why? Browsers block requests made from a web page to a different domain/port for security. CORS tells the browser "It's okay, let the frontend talk to this backend."
from fastapi.middleware.cors import CORSMiddleware

# Import StaticFiles to serve HTML, CSS, and JS directly from the backend.
from fastapi.staticfiles import StaticFiles

# Import our custom routing modules (endpoints) we defined in separate files.
from upload import router as upload_router
from query import router as query_router

# Initialize the main FastAPI application instance and give it a title for the auto-generated documentation.
app = FastAPI(title="RAG Chatbot API")

# Enable CORS for robust local connectivity.
# By setting allow_origins=["*"], we tell the server to accept requests from absolutely anywhere (perfect for local development).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach the routes we defined in upload.py and query.py to the main app.
# Now, when a request hits /upload or /query, the app knows which file handles it.
app.include_router(upload_router)
app.include_router(query_router)

# --- Serve the frontend assets ---
# Look in the parent directory for the 'frontend' folder (since we separated backend and frontend folders).
frontend_dir = os.path.join(os.path.dirname(current_dir), "frontend")

# If the frontend directory actually exists on the hard drive...
if os.path.exists(frontend_dir):
    # Mount it to the root ("/") URL path.
    # Why? This means going to http://localhost:8000 in a browser will load index.html from the frontend folder automatically!
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")