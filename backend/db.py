"""
=============================================================================
File: db.py
Description: 
    This file handles the initialization of the Vector Database and Embeddings.
    
    Key functionalities:
      - Sets up the HuggingFace embeddings model (BAAI/bge-small-en) which 
        converts textual chunks into semantic vectors.
      - Initializes ChromaDB, a local vector database, to store these embeddings
        persistently on the disk (in the 'chroma_db' folder).
=============================================================================
"""
# Import os module to handle file paths dynamically regardless of where the app is run from.
import os

# Import Chroma, a local vector database, from langchain_chroma. 
# We use this to store the text chunks and their mathematical vector representations so we can search them later.
from langchain_chroma import Chroma

# Import HuggingFaceEmbeddings to use local, open-source embedding models instead of paid ones (like OpenAI).
from langchain_huggingface import HuggingFaceEmbeddings

# Initialize the embedding model.
# Why this model? 'BAAI/bge-small-en' is chosen because it is very fast, lightweight, and provides excellent accuracy for English text.
# It runs completely locally, which ensures data privacy and zero API costs for embeddings.
embedding_model = HuggingFaceEmbeddings(
    model_name="BAAI/bge-small-en"
)

# Get the absolute directory path of the current file (db.py).
# Why? This ensures that no matter where the user runs `uvicorn` from, the database is always saved in the backend directory.
current_dir = os.path.dirname(os.path.abspath(__file__))

# Define the absolute path for the 'chroma_db' folder where the database files will physically reside.
persist_dir = os.path.join(current_dir, "chroma_db")

# Initialize the Chroma vector database instance.
# We set a collection_name to group our specific RAG data.
# We pass our embedding_model so Chroma knows how to convert incoming text into vectors automatically.
# We pass persist_directory so the database saves to the disk; otherwise, it would be deleted when the server stops.
vectordb = Chroma(
    collection_name="rag_collection",
    embedding_function=embedding_model,
    persist_directory=persist_dir
)