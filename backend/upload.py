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
    # Why? Our pipeline uses PyPDFLoader which only understands PDFs. If they upload an image, it would crash the server.
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # Construct the absolute path where the file will be saved. We prefix it with 'temp_' to identify it as a working file.
    file_path = os.path.join(APP_DIR, f"temp_{file.filename}")

    # Open the destination file path in write-binary ("wb") mode.
    with open(file_path, "wb") as buffer:
        # Use shutil to efficiently stream the uploaded file data from memory to the hard drive.
        shutil.copyfileobj(file.file, buffer)

    # --- Duplicate guard: remove existing chunks for this source ---
    # Why? If a user uploads the same PDF twice, the database will store everything twice, leading to duplicate search results and wasted space.
    try:
        # Query the database to find any existing chunks that originated from this exact file path.
        existing = vectordb._collection.get(
            where={"source": file_path}
        )
        
        # Extract the unique IDs of those existing chunks.
        existing_ids = existing.get("ids", [])
        
        # If we found IDs, it means the file was uploaded before. Delete them from the database.
        if existing_ids:
            vectordb._collection.delete(ids=existing_ids)
            print(f"[Upload] Removed {len(existing_ids)} existing chunks for '{file.filename}' before re-indexing.")
    except Exception as e:
        # If the duplicate check fails (e.g., database lock), catch the error so the server doesn't crash, but print a warning.
        print(f"[Upload] Warning: could not check for duplicates: {e}")

    # Trigger the heavy lifting: chunk the PDF and embed it into the database.
    total_chunks = process_pdf(file_path)

    # Return a JSON response to the frontend confirming success and showing how many chunks were generated.
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