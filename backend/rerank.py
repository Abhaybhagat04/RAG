"""
=============================================================================
File: rerank.py
Description: 
    This module implements a Cross-Encoder for advanced document re-ranking.
    
    Why it's needed:
      - Standard vector search (Bi-Encoder) is fast but sometimes misses exact
        contextual nuances. 
      - The Cross-Encoder acts as a "Fine Comb". It takes the top-K candidate
        chunks from the vector search and scores them against the user's 
        question to find the absolute most relevant chunks.
=============================================================================
"""
# Import CrossEncoder from sentence_transformers.
# Why? CrossEncoders process the question and the document simultaneously, allowing the model to understand the deep semantic relationship between them.
from sentence_transformers import CrossEncoder

# Initialize the Re-ranker globally outside of any function.
# Why? Machine Learning models are large and take time to load into memory. By initializing it here globally, it loads exactly once when the server starts, making subsequent queries blazing fast.
# 'ms-marco-MiniLM-L-6-v2' is chosen because it's highly optimized for question-answering retrieval (trained on the MS MARCO dataset).
reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

# Define the re-ranking function.
# It takes the user's question, a list of candidate documents (clean_docs), and how many top results we want to keep (top_k).
def rerank_documents(question: str, clean_docs: list, top_k: int = 5) -> list:
    """
    Re-ranks a list of documents based on their contextual relevance to a question.
    """
    # If the initial search found no documents, there is nothing to re-rank, so return an empty list immediately.
    if not clean_docs:
        return []
        
    # Prepare pairs of [query, chunk_text] for the Cross-Encoder.
    # Why? A CrossEncoder expects input as a list of lists: [ [question, doc1], [question, doc2], ... ]
    pairs = [[question, doc.page_content] for doc in clean_docs]
    
    # Pass the pairs to the reranker model to get a list of relevance scores (higher means more relevant).
    scores = reranker.predict(pairs)
    
    # Combine the original document objects with their new scores using zip().
    # Convert it to a list so we can sort it. Result looks like: [ (doc1, 4.5), (doc2, 1.2), ... ]
    scored_docs = list(zip(clean_docs, scores))
    
    # Sort the list in place, based on the score (x[1] is the score), in descending order (reverse=True) so the best matches are at the top.
    scored_docs.sort(key=lambda x: x[1], reverse=True)
    
    # Extract just the document objects from the sorted list, discarding the scores, and slice it to keep only the top_k results.
    top_docs = [doc for doc, score in scored_docs[:top_k]]
    
    # Return the refined, highly relevant list of documents.
    return top_docs
