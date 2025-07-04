FROM node:20-slim

# Install Python 3.11 and required dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-pip \
    python3-dev \
    build-essential \
    curl \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create symbolic links for python3
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy Python requirements and RAG module first
COPY python/requirements.txt ./python/requirements.txt
COPY python/RAG-MODULE/ ./python/RAG-MODULE/

# Setup Python virtual environment for main app
RUN python3 -m venv /app/python/venv
ENV PATH="/app/python/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r python/requirements.txt

# Make Python scripts executable and setup RAG module environment
RUN chmod +x python/RAG-MODULE/installvenv.sh

# Setup RAG module virtual environment (separate from main app venv)
# This will create python/RAG-MODULE/venv for the RAG module specifically
WORKDIR /app/python/RAG-MODULE
RUN ./installvenv.sh

# Back to app root
WORKDIR /app

# Copy the rest of the application
COPY . .

# Build client application
WORKDIR /app/client
RUN npm install && npm run build

# Back to app root
WORKDIR /app

# Make entrypoint script executable
RUN chmod +x Docker/docker-entrypoint.sh

# Expose port
EXPOSE 5640

# Set entrypoint
ENTRYPOINT ["./Docker/docker-entrypoint.sh"]

# Command to run the application
CMD ["npm", "start"]