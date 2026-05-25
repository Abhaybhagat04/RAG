"""
=============================================================================
File: rag.py
Description: 
    This module is the core engine for the RAG pipeline. It handles the extraction,
    chunking, filtering, and retrieval of document text.
    
    Key functionalities:
      - process_pdf: Reads a PDF file, splits the text into manageable chunks 
        (500 characters with 50 characters overlap), filters out "junk" chunks 
        (like very short lines or OCR artifacts), and indexes them into ChromaDB.
      - retrieve_context: The 2-stage search pipeline. It first fetches 15 
        candidates using standard vector similarity search, and then passes 
        them to the re-ranker to find the top 5 most relevant chunks.
=============================================================================
"""
# Import a text splitter from langchain.
# Why? Large documents cannot fit into an LLM's context window, nor can they be searched accurately. We must chunk them into smaller pieces.
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Import PyPDFLoader to read raw text from PDF files.
from langchain_community.document_loaders import PyPDFLoader

# Import our initialized ChromaDB instance to store and search documents.
from db import vectordb

# Import our custom re-ranking function to refine search results.
from rerank import rerank_documents

# Define a set of "junk" words.
# Why? PDFs often contain useless pages like cover pages, blank pages, or scanned images that OCR misreads. Filtering these out saves DB space and prevents the LLM from getting confused.
JUNK_WORDS = {"scanned", "urban", "this page intentionally left blank"}


def _is_junk_chunk(text: str) -> bool:
    """Return True if the chunk is too short or contains only noise content."""
    # Remove leading and trailing whitespace to get the true length of the content.
    stripped = text.strip()
    
    # If a chunk is less than 30 characters, it's usually an artifact (like a page number or header) and lacks enough semantic meaning to be useful.
    if len(stripped) < 30:
        return True
        
    # Check if the chunk is just a known junk word (like "scanned").
    if stripped.lower() in JUNK_WORDS:
        return True
        
    # If it passes the checks, it's a valid, clean chunk.
    return False


def process_pdf(file_path):
    # Initialize the PDF loader with the physical path to the uploaded PDF.
    loader = PyPDFLoader(file_path)
    
    # Extract all the text from the PDF into a list of Document objects (one per page usually).
    documents = loader.load()

    # Configure the chunking strategy.
    # Why size 500? It's large enough to hold a complete thought, but small enough for precise search.
    # Why overlap 50? Overlap prevents a sentence from being cut in half between two chunks, preserving context across chunk boundaries.
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )

    # Break the large documents down into the smaller chunks defined above.
    all_chunks = splitter.split_documents(documents)

    # Use a list comprehension to filter out any chunks that are flagged as junk by our _is_junk_chunk function.
    clean_chunks = [c for c in all_chunks if not _is_junk_chunk(c.page_content)]

    # Calculate how many chunks were removed for debugging purposes.
    removed = len(all_chunks) - len(clean_chunks)
    if removed:
        print(f"[RAG] Filtered {removed} junk chunks out of {len(all_chunks)} total.")

    # Insert the clean, high-quality chunks into our Chroma vector database. 
    # This automatically generates the embeddings under the hood using the HuggingFace model.
    vectordb.add_documents(clean_chunks)

    # Return the count of successfully processed chunks so the API can report it back to the user.
    return len(clean_chunks)


def retrieve_context(question):
    # Stage 1: Retrieval (Wide Net)
    # Perform a similarity search in ChromaDB.
    # Why k=15? We cast a wide net first to grab 15 potentially relevant chunks based on fast vector math.
    docs = vectordb.similarity_search(question, k=15)

    # Post-retrieval cleanup: skip any junk that might have slipped through from older ingestions before the filter was added.
    clean_docs = [doc for doc in docs if not _is_junk_chunk(doc.page_content)]

    # If nothing relevant was found, return an empty string so the LLM knows it has no context.
    if not clean_docs:
        return ""

    # Stage 2: Re-ranking (Fine Comb)
    # Pass the wide net results to our Cross-Encoder. It will heavily scrutinize the 15 chunks and return the absolute best 5 (top_k=5).
    top_docs = rerank_documents(question, clean_docs, top_k=5)

    # Join the final top 5 chunks into a single massive string, separated by double newlines.
    # Why? The LLM needs all the context provided as plain text in the prompt.
    context = "\n\n".join(
        [doc.page_content.strip() for doc in top_docs]
    )

    # Return the final aggregated text string.
    return context
