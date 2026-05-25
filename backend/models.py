"""
=============================================================================
File: models.py
Description: 
    This module contains the Pydantic data models used for data validation
    in the FastAPI endpoints. By defining structured models, FastAPI can 
    automatically validate incoming JSON requests and generate API documentation.
=============================================================================
"""
# Import BaseModel from pydantic. 
# Why? Pydantic is FastAPI's core validation library. Inheriting from BaseModel allows us to define strict data shapes.
from pydantic import BaseModel

# Define the expected JSON body for the /query endpoint.
# Why? If a user sends a request without a 'question' string, FastAPI will automatically reject it with a 422 Error, saving us from writing manual validation logic.
class QueryRequest(BaseModel):
    # The user's question must be a string.
    question: str