"""
=============================================================================
File: models.py
Description: 
    This module contains the Pydantic data models used for data validation
    in the FastAPI endpoints. By defining structured models, FastAPI can 
    automatically validate incoming JSON requests and generate API documentation.
=============================================================================
"""
# Import BaseModel and required types from pydantic.
from pydantic import BaseModel
from typing import List, Optional

# A single turn in the conversation history.
class ChatMessage(BaseModel):
    role: str    # "user" or "assistant"
    content: str

# Define the expected JSON body for the /query endpoint.
# chat_history is optional so existing clients without history still work.
class QueryRequest(BaseModel):
    question: str
    chat_history: Optional[List[ChatMessage]] = []