#!/bin/bash
set -e

# Copy Docker-specific config if it exists
if [ -f "/app/Docker/config.docker.ini" ]; then
  echo "Using Docker-specific configuration"
  cp /app/Docker/config.docker.ini /app/conf/config.ini
fi

# Create necessary directories
mkdir -p /app/logs
mkdir -p /app/DATA/uploads
mkdir -p /app/DATA/documents

# Set permissions
chmod -R 755 /app/python/RAG-MODULE
chmod -R 755 /app/DATA/
chmod -R 755 /app/DATA/embeddings
chmod -R 755 /app/DATA/vector_store
chmod -R 755 /app/DATA/chroma_data
chmod -R 755 /app/DATA/input
chmod -R 755 /app/DATA/output
chmod -R 755 /app/DATA/collections
chmod -R 755 /app/DATA/uploads





# Execute the command passed to the script
exec "$@" 