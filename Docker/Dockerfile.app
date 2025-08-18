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

# Copy Python requirements and RAG module
COPY python/requirements.txt ./python/requirements.txt
COPY python/RAG-MODULE/ ./python/RAG-MODULE/

# Setup Python virtual environment for main app
RUN python3 -m venv /app/python/venv
ENV PATH="/app/python/venv/bin:$PATH"

# Install main Python requirements
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r python/requirements.txt

# Install additional RAG module requirements in the same venv
RUN pip install --no-cache-dir pdfplumber==0.9.0 Pillow>=9.0.0 Wand>=0.6.7 cryptography>=38.0.0

# Make Python scripts executable
RUN chmod +x python/RAG-MODULE/installvenv.sh

# Ensure extract_text.py exists and is executable
RUN chmod +x python/RAG-MODULE/extract_text.py || echo "extract_text.py will be created from existing file"

# Copy the rest of the application
COPY . .


# Build client application
WORKDIR /app/client
# Install all dependencies including chart.js and react-chartjs-2
RUN npm install && npm run build && npm install axios react-router-dom @heroicons/react chart.js react-chartjs-2

# Back to app root
WORKDIR /app

# Make entrypoint script executable
RUN chmod +x Docker/docker-entrypoint.sh

# Expose port
EXPOSE 5641

# Set entrypoint
ENTRYPOINT ["./Docker/docker-entrypoint.sh"]

# Command to run the application
CMD ["npm", "start"]