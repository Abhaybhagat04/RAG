FROM python:3.10-slim

# Create a non-root user (required/recommended by HF Spaces)
RUN useradd -m -u 1000 user

WORKDIR /code

# Install dependencies first (layer-cached so rebuilds are fast)
COPY ./backend/requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy the full project into the container
COPY --chown=user:user . /code

# Pre-create writable runtime directories so ChromaDB and file storage work
RUN mkdir -p /code/backend/chroma_db /code/backend/storage \
    && chown -R user:user /code/backend/chroma_db /code/backend/storage

# Switch to non-root user
USER user

WORKDIR /code/backend

# HF Spaces standard port
EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
