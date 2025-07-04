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

# Execute the command passed to the script
exec "$@" 