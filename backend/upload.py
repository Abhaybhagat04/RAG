"""
=============================================================================
File: upload.py
Description: 
    This module defines the API endpoints responsible for handling file uploads
    and listing the currently indexed files.
    
    Key functionalities:
      - POST /upload: Receives a PDF file, saves it temporarily, checks if 
        it was previously uploaded (to avoid duplicate chunks in the Vector DB),
        and then triggers the ingestion pipeline (process_pdf).
      - GET /files: Scans the temporary storage directory and returns a list 
        of all currently active PDF files.
=============================================================================
"""
# Import os and glob for interacting with the file system (saving files, finding files).
import os
import glob

# Import shutil for efficient file copying operations (saving the uploaded file stream).
import shutil

# Import FastAPI components. APIRouter allows us to split routes across multiple files instead of putting them all in main.py.
# UploadFile is the data type for receiving files, and HTTPException is used to return standard web errors.
from fastapi import APIRouter, UploadFile, HTTPException

# Import the RAG pipeline processing function.
from rag import process_pdf

# Import the Vector DB instance to manually manage records (like deleting duplicates).
from db import vectordb

# Create a router instance to register our endpoints on.
router = APIRouter()

# Get the absolute directory path of this script so we can save files reliably in the backend folder.
APP_DIR = os.path.dirname(os.path.abspath(__file__))


# Define an endpoint that listens for POST requests at /upload.
@router.post("/upload")
async def upload_pdf(file: UploadFile):
    # Security/Validation: Ensure the uploaded file has a .pdf extension.
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # --- Step 1: Delete ALL previous temp PDFs from disk ---
    # Why? We only want answers from the currently uploaded document.
    old_pdfs = glob.glob(os.path.join(APP_DIR, "temp_*.pdf"))
    for old_pdf in old_pdfs:
        try:
            os.remove(old_pdf)
            print(f"[Upload] Deleted old file: {os.path.basename(old_pdf)}")
        except Exception as e:
            print(f"[Upload] Warning: could not delete old file {old_pdf}: {e}")

    # --- Step 2: Wipe the entire ChromaDB collection ---
    # Why? Ensures zero contamination from previously uploaded documents.
    try:
        all_docs = vectordb._collection.get()
        all_ids = all_docs.get("ids", [])
        if all_ids:
            vectordb._collection.delete(ids=all_ids)
            print(f"[Upload] Cleared {len(all_ids)} chunks from previous documents.")
    except Exception as e:
        print(f"[Upload] Warning: could not clear collection: {e}")

    # --- Step 3: Save the new file ---
    file_path = os.path.join(APP_DIR, f"temp_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # --- Step 4: Index the new file ---
    total_chunks = process_pdf(file_path)

    return {
        "message": "PDF uploaded and indexed successfully",
        "filename": file.filename,
        "chunks": total_chunks
    }



# Define an endpoint that listens for GET requests at /files.
@router.get("/files")
async def list_files():
    # Construct a search pattern to find all files starting with "temp_" and ending with ".pdf" in the backend directory.
    pattern = os.path.join(APP_DIR, "temp_*.pdf")
    
    # glob.glob finds all physical files matching the pattern.
    # We then use a list comprehension to extract just the base filename (e.g., "temp_document.pdf")
    # and we remove the "temp_" prefix so the frontend displays the clean original name to the user.
    files = sorted([
        os.path.basename(f).replace("temp_", "")
        for f in glob.glob(pattern)
    ])
    
    # Return the clean list of files as a JSON response.
    return {"files": files}