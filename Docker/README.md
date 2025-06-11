# 🐳 Docker Setup Guide - Product Demo Platform

This guide provides complete instructions for setting up and running the Product Demo Platform using Docker, including the new **BullMQ-based document processing queue system**.

## 📋 Table of Contents

- [🏗️ System Architecture](#️-system-architecture)
- [📦 Prerequisites](#-prerequisites)
- [🚀 Quick Start](#-quick-start)
- [⚙️ Configuration](#️-configuration)
- [🔧 Services Overview](#-services-overview)
- [📊 Database Setup](#-database-setup)
- [🔄 Document Queue System](#-document-queue-system)
- [🌐 Environment Variables](#-environment-variables)
- [🛠️ Development Setup](#️-development-setup)
- [📈 Monitoring & Logs](#-monitoring--logs)
- [🔍 Troubleshooting](#-troubleshooting)
- [🚀 Production Deployment](#-production-deployment)

---

## 🏗️ System Architecture

### **Hybrid Containerization Approach**

This application uses a **hybrid containerization strategy** where:
- **Core infrastructure services** (Redis, ChromaDB) are containerized
- **Document processing workers** are containerized for scalability
- **Main application** (Backend + Frontend) runs on the host system
- **Database** can be either containerized or use host PostgreSQL

```
┌─────────────────────────────────────────────────────────────┐
│                    HOST SYSTEM                              │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   Backend       │    │   PostgreSQL    │                │
│  │   (Node.js)     │◄──►│   (Host/Docker) │                │
│  │   Port: 5634    │    │   Port: 5432    │                │
│  │                 │    └─────────────────┘                │
│  │  Serves Frontend│                                        │
│  │  Build Files    │    ┌─────────────────┐                │
│  │  (React SPA)    │    │   Ollama/LLM    │                │
│  └─────────────────┘    │   (Host System) │                │
│           │              │   Port: 11434   │                │
│           │              └─────────────────┘                │
│           │                                                 │
│  ┌────────▼────────────────────────────────────────────────┤
│  │              DOCKER CONTAINERS                          │
│  │  ┌─────────────────┐    ┌─────────────────┐            │
│  │  │     Redis       │    │    ChromaDB     │            │
│  │  │   (Queue)       │    │  (Vector Store) │            │
│  │  │   Port: 6379    │    │   Port: 8000    │            │
│  │  └─────────────────┘    └─────────────────┘            │
│  │           │                       │                     │
│  │  ┌─────────▼───────────────────────▼─────┐              │
│  │  │        Document Workers               │              │
│  │  │        (BullMQ Workers)               │              │
│  │  │        3-5 Scalable Instances         │              │
│  │  └───────────────────────────────────────┘              │
│  └─────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
```

### **Key Architectural Points**

1. **Single Port Access**: The entire application is accessible via **one port** (5634)
2. **Backend Serves Frontend**: Node.js backend serves the React build files as static content
3. **API + SPA**: All API routes are under `/api/*`, frontend routes handled by React Router
4. **Containerized Workers**: Only the document processing workers are containerized for scalability
5. **External LLM Integration**: Ollama/LLM services run on the host system, not in containers

---

## 📦 Prerequisites

### Required Software
- **Docker**: Version 20.0+ ([Download](https://docs.docker.com/get-docker/))
- **Docker Compose**: Version 2.0+ (included with Docker Desktop)
- **Node.js**: Version 18+ (for running the main application)
- **PostgreSQL**: Either host installation or Docker container
- **Ollama**: For LLM integration (host installation recommended)

### System Requirements
- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: 10GB free space
- **CPU**: 4+ cores recommended
- **Network**: Internet connection for downloading dependencies

### Verify Installation
```bash
# Check Docker version
docker --version
# Should output: Docker version 20.x.x or higher

# Check Node.js version
node --version
# Should output: v18.x.x or higher

# Check PostgreSQL (if using host installation)
psql --version
# Should output: psql (PostgreSQL) 12.x or higher
```

---

## 🚀 Quick Start

### Step-by-Step Setup Guide

#### 1. **Clone the Repository**
```bash
git clone <repository-url>
cd c2s_integrate
```

#### 2. **Verify Prerequisites**
```bash
# Check Docker installation
docker --version
docker compose version

# Check Node.js installation
node --version  # Should be 18+
npm --version

# Check if ports are available
netstat -tulpn | grep -E "(5634|5432|6379|8001|11434)"
```

#### 3. **Choose Database Setup**

**Option A: Host PostgreSQL (Production Recommended)**
```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt update && sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE copilot;
CREATE USER postgres WITH PASSWORD 'root';
GRANT ALL PRIVILEGES ON DATABASE copilot TO postgres;
\q

# Test connection
psql -h localhost -U postgres -d copilot -c "SELECT 1;"
```

**Option B: Docker PostgreSQL (Development)**
```bash
# Add to docker-compose.yml (see Configuration section)
# Will be started with other services in step 6
```

#### 4. **Install Application Dependencies**
```bash
# Install backend dependencies
npm install

# Install frontend dependencies and build
cd client
npm install
npm run build
cd ..

# Verify build was created
ls -la client/build/
```

#### 5. **Configure Environment Files**
```bash
# Copy configuration templates
cp conf/config.ini conf/config.local.ini
cp Docker/env.docker .env

# Edit database configuration
nano conf/config.local.ini
# Update [database] section with your PostgreSQL settings

# Edit Docker environment (if needed)
nano .env
# Adjust worker concurrency, memory limits, etc.
```

#### 6. **Build and Start Docker Services**
```bash
cd Docker

# Build custom images (first time only)
docker compose build

# Start all infrastructure services
docker compose up -d

# Verify all services are running
docker compose ps
# Should show: redis, chromadb, doc-workers, image-processor

# Check service health
docker compose logs redis
docker compose logs chromadb
docker compose logs doc-workers
```

#### 7. **Initialize Database Schema**
```bash
# Return to project root
cd ..

# Run database migrations
npm run db:migrate
npm run db:migrate:queue

# Verify tables were created
psql -h localhost -U postgres -d copilot -c "\dt"
```

#### 8. **Start the Main Application**
```bash
# Start backend (serves frontend automatically)
npm start

# Or for development with auto-reload
npm run dev

# Application should start on port 5634
```

#### 9. **Verify Complete Setup**

**Check Application Access:**
```bash
# Main application
curl http://localhost:5634
# Should return HTML content

# API health check
curl http://localhost:5634/api/health
# Should return {"status": "ok"}

# Frontend should load in browser
open http://localhost:5634
```

**Check Service Connectivity:**
```bash
# Redis connectivity
docker compose exec redis redis-cli ping
# Should return: PONG

# ChromaDB connectivity
curl http://localhost:8001/api/v1/heartbeat
# Should return: {"nanosecond heartbeat": ...}

# Database connectivity
psql -h localhost -U postgres -d copilot -c "SELECT version();"
```

**Check Worker Functionality:**
```bash
# View worker logs
docker compose logs -f doc-workers

# Test document processing (if you have a test PDF)
# Upload a document through the web interface
# Check logs for processing activity
```

#### 10. **Optional: Setup Ollama (AI Models)**
```bash
# Install Ollama on host (recommended)
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve &

# Pull required models
ollama pull llama2
ollama pull codellama

# Test Ollama connectivity
curl http://localhost:11434/api/tags
```

### 🎯 Access Points Summary

After successful setup, you can access:

| Service | URL | Purpose |
|---------|-----|---------|
| **Main Application** | http://localhost:5634 | Complete web interface |
| **API Endpoints** | http://localhost:5634/api/* | REST API access |
| **ChromaDB Admin** | http://localhost:8001 | Vector database interface |
| **Redis CLI** | `docker compose exec redis redis-cli` | Queue management |
| **Database** | `psql -h localhost -U postgres copilot` | Direct database access |
| **Ollama API** | http://localhost:11434 | AI model interface |

### ⚡ Quick Commands Reference

```bash
# === DAILY OPERATIONS ===
cd Docker && docker compose up -d    # Start all services
npm start                           # Start main application
docker compose ps                   # Check service status
docker compose logs -f doc-workers  # Monitor workers

# === DEVELOPMENT ===
cd client && npm run build && cd .. # Rebuild frontend
npm run dev                         # Development mode
docker compose restart doc-workers  # Restart workers after code changes

# === MAINTENANCE ===
docker compose down                 # Stop all services
docker compose pull                # Update pre-built images
docker compose build --no-cache    # Rebuild custom images
```

---

## ⚙️ Configuration

### Database Configuration Options

#### Option 1: Host PostgreSQL (Production Recommended)
```ini
# conf/config.ini
[database]
database-type = postgres
database-host = localhost
database-port = 5432
database-user = productdemo_user
database-password = your_secure_password
database-name = productdemo
```

#### Option 2: Docker PostgreSQL (Development)
Add to `Docker/docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: productdemo-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: productdemo
      POSTGRES_USER: productdemo_user
      POSTGRES_PASSWORD: your_secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - productdemo-network

volumes:
  postgres_data:
    driver: local
```

Then update config:
```ini
[database]
database-host = localhost  # Still localhost since port is exposed
```

### LLM/Ollama Integration

#### Host Ollama Setup (Recommended)
```bash
# Install Ollama on your host system
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve

# Pull required models
ollama pull llama2
ollama pull codellama
```

Configuration:
```ini
# conf/config.ini
[ai]
ollama_host = http://localhost:11434  # Host system Ollama
```

#### Docker Ollama Setup (Alternative)
```yaml
# Add to docker-compose.yml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: productdemo-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped
    networks:
      - productdemo-network
```

Configuration:
```ini
[ai]
ollama_host = http://localhost:11434  # Docker Ollama via exposed port
```

### Frontend Build Configuration

The backend automatically serves the frontend build files:

```ini
# conf/config.ini
[server]
static_root_path = ./client/build  # Path to React build files
serve_static = true
```

**Important**: Always run `npm run build` in the client directory after frontend changes!

---

## 🔧 Services Overview & Docker Images

### 📊 Port Mapping Summary
| Service | Default Host Port | Container Port | Purpose | Configuration |
|---------|-------------------|----------------|---------|---------------|
| **Main Application** | 5634 | N/A (Host) | Backend + Frontend | `conf/config.ini` → `[server] port` |
| **Redis** | 6379 | 6379 | Queue Management | `conf/config.ini` → `[redis] port` |
| **ChromaDB** | 8001 | 8000 | Vector Database | `conf/config.ini` → `[docker] chromadb_port` |
| **PostgreSQL** | 5432 | 5432 | Primary Database | `conf/config.ini` → `[database] database-port` |
| **Ollama/LLM** | 11434 | N/A (Host) | AI Model Inference | `conf/config.ini` → `[ollama] port` |
| **Chat2SQL** | 5000 | 5000 | Natural Language to SQL | `conf/config.ini` → `[chat2sql] port` |

**🔧 All ports are configurable via `conf/config.ini` - no hardcoded values!**

**📡 Get current port configuration:**
```bash
curl http://localhost:5634/api/config/ports
```

### 🗣️ Chat2SQL Service

The Chat2SQL service provides natural language to SQL query conversion using AI. It's fully dockerized and integrated with the main application.

**Key Features:**
- 🤖 **AI-Powered**: Uses Ollama (Mistral model) for natural language understanding
- 🔒 **Secure**: Only allows SELECT queries for safety
- 📊 **Formatted Output**: Returns results as markdown tables
- 🔄 **Session Support**: Maintains query history per chat session
- 🐳 **Dockerized**: Runs in isolated container with proper resource limits

**Quick Setup:**
```bash
# Automated setup (recommended)
node src/scripts/setup-chat2sql.js

# Manual setup
cd Docker
docker compose build chat2sql
docker compose up -d chat2sql

# Test the service
node src/scripts/test-chat2sql-docker.js
```

**Usage in Application:**
1. Start the main application: `npm start`
2. Open the chat interface
3. Click the "Chat2SQL" toggle button
4. Ask questions like:
   - "list all tables"
   - "show me all users"
   - "count rows in sessions table"
   - "what columns are in the documents table?"

---

### 🐳 Docker Images & Services

#### 1. **Main Application (Host System)**
```yaml
# Not containerized - runs directly on host
Type: Host Application
Port: 5634 (configurable)
```
- **Components**:
  - Node.js Backend (API server, WebSocket, static file serving)
  - React Frontend (served as static build files)
- **Purpose**: Main application logic, user interface, API endpoints
- **Access**: http://localhost:5634
- **Why Host**: Better performance, easier development, single port access
- **Build Process**: `npm install` → `cd client && npm run build` → `npm start`

#### 2. **Redis (Pre-built Image)**
```yaml
# docker-compose.yml
redis:
  image: redis:7-alpine
  container_name: productdemo-redis
  ports: ["6379:6379"]
```
- **Image Source**: Official Redis Alpine image from Docker Hub
- **Purpose**: Queue management for BullMQ, session storage, caching
- **Configuration**:
  - Memory limit: 512MB
  - Persistence: AOF enabled
  - Policy: allkeys-lru
- **Data Storage**: Named volume `redis_data`
- **Health Check**: `redis-cli ping` every 30s
- **Scaling**: Single instance sufficient for most workloads

#### 3. **ChromaDB (Pre-built Image)**
```yaml
# docker-compose.yml
chromadb:
  image: chromadb/chroma:latest
  container_name: productdemo-chromadb
  ports: ["8001:8000"]
```
- **Image Source**: Official ChromaDB image from Docker Hub
- **Purpose**: Vector database for document embeddings and similarity search
- **Port Mapping**: Host 8001 → Container 8000 (to avoid conflicts)
- **Configuration**:
  - CORS enabled for all origins
  - Reset functionality enabled
  - Host binding: 0.0.0.0:8000
- **Data Storage**: Bind mount `./DATA/chroma_data:/chroma/chroma`
- **API Access**: http://localhost:8001/api/v1/heartbeat

#### 4. **Document Workers (Custom Built Image)**
```yaml
# docker-compose.yml
doc-workers:
  build:
    context: ..
    dockerfile: Docker/Dockerfile.workers
  container_name: productdemo-doc-workers
```
- **Base Image**: `node:18-alpine3.16`
- **Build Context**: Project root directory
- **Dockerfile**: `Docker/Dockerfile.workers`
- **Purpose**: Asynchronous document processing (PDF/DOCX parsing, embedding generation)
- **Features**:
  - BullMQ worker implementation
  - Python virtual environment for document processing
  - ImageMagick and Poppler for PDF handling
  - Horizontal scaling support (1-10 instances)
- **Resource Limits**: 1GB RAM, 1 CPU core
- **Dependencies**: Redis (queue), ChromaDB (storage)
- **Scaling**: `docker compose up -d --scale doc-workers=5`

#### 5. **Image Processor (Custom Built Image)**
```yaml
# docker-compose.yml
image-processor:
  build:
    context: ..
    dockerfile: Docker/Dockerfile.image-processor
  container_name: productdemo-image-processor
```
- **Base Image**: `python:3.9-slim`
- **Build Context**: Project root directory
- **Dockerfile**: `Docker/Dockerfile.image-processor`
- **Purpose**: OCR-based image processing for RAG system
- **Features**:
  - Tesseract OCR with multiple language support
  - PDF image extraction
  - User-isolated image collections
  - ChromaDB integration for image metadata
- **OCR Languages**: English, French, German, Spanish, Italian, Portuguese
- **Resource Limits**: 2GB RAM, 1.5 CPU cores
- **Data Storage**: Bind mounts for input/output and collections

#### 6. **Chat2SQL (Custom Built Image)**
```yaml
# docker-compose.yml
chat2sql:
  build:
    context: ..
    dockerfile: Docker/Dockerfile.chat2sql
  container_name: productdemo-chat2sql
  ports: ["5000:5000"]
```
- **Base Image**: `python:3.9-slim`
- **Build Context**: Project root directory
- **Dockerfile**: `Docker/Dockerfile.chat2sql`
- **Purpose**: Natural language to SQL query conversion and execution
- **Features**:
  - FastAPI-based REST API
  - Ollama integration for AI-powered SQL generation
  - PostgreSQL database connectivity
  - Session-based query history
  - Markdown table response formatting
- **Port**: 5000 (configurable via `CHAT2SQL_HOST_PORT`)
- **Resource Limits**: 1GB RAM, 1 CPU core
- **Dependencies**: Ollama (host), PostgreSQL database
- **API Endpoint**: `/chat2sql/execute`

#### 6. **PostgreSQL (Host or Container)**
```yaml
# Optional - can be added to docker-compose.yml
postgres:
  image: postgres:15-alpine
  container_name: productdemo-postgres
  ports: ["5432:5432"]
```
- **Image Source**: Official PostgreSQL Alpine image
- **Purpose**: Primary application database
- **Recommendation**: Host installation for production
- **Data**: User accounts, chat sessions, document metadata
- **Configuration**: Database name, user, and password via environment variables
- **Data Storage**: Named volume `postgres_data` (if containerized)

#### 7. **Ollama/LLM (Host Recommended)**
```yaml
# Optional - can be added to docker-compose.yml
ollama:
  image: ollama/ollama:latest
  container_name: productdemo-ollama
  ports: ["11434:11434"]
```
- **Image Source**: Official Ollama image
- **Purpose**: Large Language Model inference
- **Recommendation**: Host installation for better GPU access and performance
- **Models**: Configurable (llama2, codellama, mistral, etc.)
- **GPU Support**: Better on host system
- **Data Storage**: Named volume `ollama_data` for models

---

## ⚙️ Configuration Management

### 🎯 No Hardcoded Values Policy

This application follows a **strict no-hardcoding policy** for ports, URLs, and configuration values. All settings are managed through:

1. **Primary Configuration**: `conf/config.ini`
2. **Docker Environment**: `Docker/env.docker`
3. **Runtime Validation**: Automatic validation on startup

### 📋 Configuration Sections

#### Server Configuration
```ini
[server]
protocol = http
domain = localhost
port = 5634                    # Main application port
static_root_path = ./client/build
```

#### Docker Services
```ini
[docker]
# ChromaDB configuration
chromadb_protocol = http
chromadb_host = localhost
chromadb_port = 8001          # Host port for ChromaDB

# Redis configuration
redis_host = localhost
redis_port = 6379             # Host port for Redis

# PostgreSQL configuration
postgres_host = localhost
postgres_port = 5432          # Host port for PostgreSQL
```

#### Ollama AI Service
```ini
[ollama]
protocol = http
host = localhost
port = 11434                  # Ollama server port
connection_timeout = 30000
request_timeout = 120000
```

### 🔍 Configuration Validation

The system automatically validates all configuration on startup:

```bash
# Check configuration health
curl http://localhost:5634/api/config/health

# Get all port mappings
curl http://localhost:5634/api/config/ports

# Validate configuration (admin only)
curl -H "Authorization: Bearer admin-token" http://localhost:5634/api/config/validated
```

### 🛠️ Changing Ports

To change any service port:

1. **Edit `conf/config.ini`**:
   ```ini
   [server]
   port = 8080  # Change main app port

   [docker]
   chromadb_port = 9001  # Change ChromaDB port
   ```

2. **Update Docker environment** (if using Docker):
   ```bash
   # Edit Docker/env.docker
   CHROMADB_HOST_PORT=9001
   ```

3. **Restart services**:
   ```bash
   # Restart Docker services
   cd Docker && docker compose down && docker compose up -d

   # Restart main application
   npm start
   ```

### 🔧 Environment Variable Override

Docker services support environment variable overrides:

```bash
# Override ChromaDB port
CHROMADB_HOST_PORT=9001 docker compose up -d

# Override Redis port
REDIS_HOST_PORT=7379 docker compose up -d
```

### ✅ Configuration Best Practices

1. **Always use config.ini**: Never hardcode ports or URLs
2. **Validate on startup**: Check configuration health endpoint
3. **Document changes**: Update this README when adding new config options
4. **Test port changes**: Verify all services after port modifications
5. **Use environment overrides**: For temporary testing or deployment variations

---

## 🏗️ Building Custom Docker Images

### Overview of Custom Images

The system uses **2 custom-built Docker images** and **3 pre-built images**:

**Custom Built Images:**
1. **Document Workers** (`Dockerfile.workers`) - Node.js + Python for document processing
2. **Image Processor** (`Dockerfile.image-processor`) - Python + OCR for image extraction

**Pre-built Images:**
1. **Redis** (`redis:7-alpine`) - Queue management
2. **ChromaDB** (`chromadb/chroma:latest`) - Vector database
3. **PostgreSQL** (`postgres:15-alpine`) - Optional database container

### Building Document Workers Image

#### Dockerfile.workers Analysis
```dockerfile
FROM node:18-alpine3.16

# System dependencies for document processing
RUN apk add --no-cache \
    bash curl imagemagick poppler-utils \
    build-base libffi-dev openssl-dev \
    python3 python3-dev py3-pip

# Python virtual environment setup
RUN python3 -m venv /app/python/.venv
COPY python/requirements.txt /app/python/requirements.txt
RUN /app/python/.venv/bin/pip install -r /app/python/requirements.txt

# Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production

# Application code
COPY src ./src
COPY conf ./conf

# Security: non-root user
USER node
```

#### Build Commands
```bash
# Build document workers image
cd Docker
docker build -f Dockerfile.workers -t productdemo-doc-workers ..

# Or build via docker-compose
docker compose build doc-workers

# Build with no cache (force rebuild)
docker compose build --no-cache doc-workers

# View build logs
docker compose build doc-workers --progress=plain
```

#### Image Features
- **Base**: Alpine Linux (lightweight)
- **Runtime**: Node.js 18 + Python 3.9
- **Document Processing**: ImageMagick, Poppler (PDF tools)
- **Python Libraries**: PyMuPDF, langchain, chromadb
- **Security**: Runs as non-root user
- **Size**: ~800MB (optimized)

### Building Image Processor Image

#### Dockerfile.image-processor Analysis
```dockerfile
FROM python:3.9-slim

# OCR and image processing dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr tesseract-ocr-eng tesseract-ocr-fra \
    tesseract-ocr-deu tesseract-ocr-spa tesseract-ocr-ita \
    tesseract-ocr-por libtesseract-dev libleptonica-dev \
    libpoppler-cpp-dev libmagic1 build-essential

# Python dependencies
COPY python/RAG-MODULE/image-processing/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Application scripts
COPY python/RAG-MODULE/image-processing/ /app/image-processing/

# Security: non-root user
USER imageprocessor
```

#### Build Commands
```bash
# Build image processor
cd Docker
docker build -f Dockerfile.image-processor -t productdemo-image-processor ..

# Or build via docker-compose
docker compose build image-processor

# Test the build
./test-image-processing.sh

# Build with specific tag
docker build -f Dockerfile.image-processor -t productdemo-image-processor:v1.0 ..
```

#### Image Features
- **Base**: Debian Slim (better OCR support)
- **OCR**: Tesseract with 6 language packs
- **Image Processing**: PIL, PyMuPDF, OpenCV
- **Languages**: EN, FR, DE, ES, IT, PT
- **Security**: Runs as non-root user
- **Size**: ~1.2GB (includes OCR data)

### Image Management Commands

#### Building All Images
```bash
# Build all custom images
cd Docker
docker compose build

# Build specific image
docker compose build doc-workers
docker compose build image-processor

# Force rebuild (no cache)
docker compose build --no-cache

# Build with parallel processing
docker compose build --parallel
```

#### Image Information
```bash
# List all images
docker images | grep productdemo

# Image details
docker inspect productdemo-doc-workers
docker inspect productdemo-image-processor

# Image size and layers
docker history productdemo-doc-workers
docker history productdemo-image-processor

# Remove images
docker rmi productdemo-doc-workers
docker rmi productdemo-image-processor
```

#### Testing Built Images

**Test Document Workers:**
```bash
# Test worker connectivity
docker run --rm --network productdemo-network \
  -e REDIS_HOST=redis -e CHROMADB_HOST=chromadb \
  productdemo-doc-workers node -e "console.log('Worker test OK')"

# Test Python environment
docker run --rm productdemo-doc-workers \
  /app/python/.venv/bin/python -c "import fitz, chromadb; print('Dependencies OK')"
```

**Test Image Processor:**
```bash
# Run comprehensive test
cd Docker
./test-image-processing.sh

# Test OCR manually
docker run --rm productdemo-image-processor tesseract --version

# Test Python dependencies
docker run --rm productdemo-image-processor \
  python -c "import pytesseract, fitz, PIL; print('OCR dependencies OK')"
```

### Troubleshooting Image Builds

#### Common Build Issues

**1. Docker Build Context Too Large**
```bash
# Problem: Build context includes large files
# Solution: Use .dockerignore file
echo "node_modules/
DATA/
logs/
*.log" > .dockerignore
```

**2. Python Dependencies Fail**
```bash
# Problem: Missing system dependencies
# Solution: Check Dockerfile system packages
docker build --no-cache -f Dockerfile.workers ..
```

**3. Permission Issues**
```bash
# Problem: File permissions in container
# Solution: Check user/group settings
docker run --rm -it productdemo-doc-workers ls -la /app
```

**4. Network Issues During Build**
```bash
# Problem: Cannot download packages
# Solution: Check network and proxy settings
docker build --network=host -f Dockerfile.workers ..
```

#### Build Optimization Tips

**1. Layer Caching**
```dockerfile
# Copy requirements first (better caching)
COPY requirements.txt .
RUN pip install -r requirements.txt
# Then copy application code
COPY . .
```

**2. Multi-stage Builds**
```dockerfile
# Use multi-stage for smaller final image
FROM node:18-alpine as builder
# Build steps...

FROM node:18-alpine as runtime
COPY --from=builder /app/dist /app
```

**3. Minimize Image Size**
```dockerfile
# Clean up after package installation
RUN apt-get update && apt-get install -y packages \
    && rm -rf /var/lib/apt/lists/*
```

---

## 📊 Database Setup

### Host PostgreSQL Setup (Recommended)

```bash
# 1. Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# 2. Create database and user
sudo -u postgres psql
CREATE DATABASE productdemo;
CREATE USER productdemo_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE productdemo TO productdemo_user;
\q

# 3. Update configuration
# Edit conf/config.ini with the database details

# 4. Run migrations
npm run db:migrate
npm run db:migrate:queue
```

### Docker PostgreSQL Setup

```bash
# 1. Add PostgreSQL to docker-compose.yml (see Configuration section)

# 2. Start PostgreSQL container
cd Docker
docker compose up -d postgres

# 3. Wait for database to be ready
docker compose logs postgres

# 4. Run migrations
cd ..
npm run db:migrate
npm run db:migrate:queue
```

### Database Management

```bash
# Connect to host PostgreSQL
psql -h localhost -U productdemo_user -d productdemo

# Connect to Docker PostgreSQL
docker compose exec postgres psql -U productdemo_user -d productdemo

# Backup database
pg_dump -h localhost -U productdemo_user productdemo > backup.sql

# Restore database
psql -h localhost -U productdemo_user productdemo < backup.sql
```

---

## 🔄 Document Queue System

### Architecture
```
Frontend Upload → Backend API → Redis Queue → Docker Workers → ChromaDB
     ↓              ↓              ↓              ↓              ↓
   User UI      Queue Job      BullMQ         Processing    Vector Storage
                Creation       Management      (PDF/DOCX)    (Embeddings)
```

### Worker Management

```bash
# Start workers
cd Docker
docker compose up -d doc-workers

# Scale workers (increase processing capacity)
docker compose up -d --scale doc-workers=5

# View worker logs
docker compose logs -f doc-workers

# Restart workers
docker compose restart doc-workers

# Stop workers
docker compose stop doc-workers
```

### Queue Monitoring

```bash
# Check queue status via API
curl http://localhost:5634/api/documents/processing-status

# Monitor Redis queue directly
docker compose exec redis redis-cli
> KEYS bull:document-processing:*
> LLEN bull:document-processing:waiting
> LLEN bull:document-processing:active
```

---

## 🌐 Environment Variables

### Application Environment (.env)
```bash
# Redis Configuration (for Docker services)
REDIS_HOST=redis
REDIS_PORT=6379

# Document Queue Configuration
DOC_WORKER_CONCURRENCY=3
QUEUE_MAX_RETRIES=3

# ChromaDB Configuration
CHROMADB_HOST=chromadb
CHROMADB_PORT=8000

# Database Configuration (if using Docker PostgreSQL)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=productdemo
DATABASE_USER=productdemo_user
DATABASE_PASSWORD=your_secure_password
```

### Configuration File (conf/config.ini)
```ini
[server]
port = 5634
static_root_path = ./client/build

[database]
database-type = postgres
database-host = localhost
database-port = 5432
database-name = productdemo
database-user = productdemo_user
database-password = your_secure_password

[redis]
host = localhost
port = 6379

[ai]
ollama_host = http://localhost:11434
```

---

## 🛠️ Development Setup

### Full Local Development
```bash
# 1. Start infrastructure services only
cd Docker
docker compose up -d redis chromadb

# 2. Install dependencies
cd ..
npm install
cd client && npm install && cd ..

# 3. Build frontend
cd client && npm run build && cd ..

# 4. Start backend in development mode
npm run dev

# 5. For frontend development (separate terminal)
cd client && npm start
# This runs on port 3000 for hot reload
```

### Production-like Development
```bash
# 1. Start all infrastructure
cd Docker
docker compose up -d

# 2. Build frontend
cd client && npm run build && cd ..

# 3. Start backend
npm start
# Access complete app on http://localhost:5634
```

### Code Changes Workflow

#### Frontend Changes
```bash
# 1. Make changes in client/src/
# 2. Build frontend
cd client && npm run build && cd ..
# 3. Restart backend to serve new build
npm run dev  # or restart if using npm start
```

#### Backend Changes
```bash
# 1. Make changes in src/
# 2. Restart backend (auto-restart with npm run dev)
```

#### Worker Changes
```bash
# 1. Make changes to worker code
# 2. Rebuild and restart workers
cd Docker
docker compose build doc-workers
docker compose restart doc-workers
```

---

## 📈 Monitoring & Logs

### Application Logs
```bash
# Backend logs (main application)
tail -f logs/app.log

# Development logs (console)
npm run dev  # Shows logs in console

# Worker logs
cd Docker
docker compose logs -f doc-workers
```

### Service Health Checks
```bash
# Main application health
curl http://localhost:5634/api/health

# Redis health
docker compose exec redis redis-cli ping

# ChromaDB health
curl http://localhost:8000/api/v1/heartbeat

# PostgreSQL health (host)
pg_isready -h localhost -p 5432

# PostgreSQL health (Docker)
docker compose exec postgres pg_isready
```

### Performance Monitoring
```bash
# Application resource usage
ps aux | grep node

# Docker container resources
docker stats

# Database connections
# Connect to PostgreSQL and run:
SELECT count(*) FROM pg_stat_activity;
```

---

## 🔍 Troubleshooting

### Service-Specific Troubleshooting

#### 1. **Main Application Issues**

**Frontend Not Loading:**
```bash
# Check if build exists and is recent
ls -la client/build/
stat client/build/index.html

# Rebuild frontend
cd client && npm run build && cd ..

# Check backend static file serving
curl -I http://localhost:5634/
curl http://localhost:5634/ | head -20

# Check backend configuration
grep -A 5 "static_root_path" conf/config.ini
```

**API Routes Not Working:**
```bash
# Test API health endpoint
curl -v http://localhost:5634/api/health

# Check backend logs
tail -f logs/app.log

# Test specific API endpoints
curl http://localhost:5634/api/users/me
curl http://localhost:5634/api/documents/

# Check if backend is binding to correct port
netstat -tulpn | grep 5634
```

#### 2. **Database Connection Issues**

**PostgreSQL Connection Problems:**
```bash
# Test direct connection
psql -h localhost -U postgres -d copilot -c "SELECT version();"

# Check if PostgreSQL is running
sudo systemctl status postgresql
# or for Docker: docker compose ps postgres

# Verify database configuration
cat conf/config.ini | grep -A 10 "\[database\]"

# Check database exists and user has permissions
psql -h localhost -U postgres -l
psql -h localhost -U postgres -d copilot -c "\dt"

# Test connection with application config
node -e "
const config = require('./src/config/database');
console.log('DB Config:', config);
"
```

#### 3. **Docker Services Issues**

**Redis Problems:**
```bash
# Check Redis container status
docker compose ps redis
docker compose logs redis

# Test Redis connectivity
docker compose exec redis redis-cli ping
docker compose exec redis redis-cli info

# Check Redis memory usage
docker compose exec redis redis-cli info memory

# Test from application
node -e "
const Redis = require('ioredis');
const redis = new Redis('localhost', 6379);
redis.ping().then(console.log).catch(console.error);
"
```

**ChromaDB Issues:**
```bash
# Check ChromaDB container status
docker compose ps chromadb
docker compose logs chromadb

# Test ChromaDB API
curl http://localhost:8001/api/v1/heartbeat
curl http://localhost:8001/api/v1/version

# Check ChromaDB collections
curl http://localhost:8001/api/v1/collections

# Verify data directory
ls -la Docker/DATA/chroma_data/

# Test from application
node -e "
const { ChromaClient } = require('chromadb');
const client = new ChromaClient('http://localhost:8001');
client.heartbeat().then(console.log).catch(console.error);
"
```

#### 4. **Document Workers Issues**

**Worker Not Processing Documents:**
```bash
# Check worker container status
docker compose ps doc-workers
docker compose logs -f doc-workers

# Check worker resource usage
docker stats productdemo-doc-workers

# Test worker dependencies
docker compose exec doc-workers node -e "
const Redis = require('ioredis');
const redis = new Redis('redis', 6379);
redis.ping().then(() => console.log('Redis OK')).catch(console.error);
"

# Test Python environment in worker
docker compose exec doc-workers /app/python/.venv/bin/python -c "
import fitz, chromadb
print('Python dependencies OK')
"

# Check queue status
docker compose exec redis redis-cli KEYS "bull:*"
docker compose exec redis redis-cli LLEN "bull:document-processing:waiting"
```

**Scale Workers for Better Performance:**
```bash
# Scale up workers
docker compose up -d --scale doc-workers=3

# Check all worker instances
docker ps | grep doc-workers

# Monitor worker distribution
docker compose logs -f doc-workers | grep "Processing job"
```

#### 5. **Image Processor Issues**

**OCR Not Working:**
```bash
# Check image processor status
docker compose ps image-processor
docker compose logs image-processor

# Test Tesseract installation
docker compose exec image-processor tesseract --version

# Test OCR functionality
docker compose exec image-processor python -c "
import pytesseract
from PIL import Image, ImageDraw
img = Image.new('RGB', (200, 50), 'white')
draw = ImageDraw.Draw(img)
draw.text((10, 10), 'Test OCR', fill='black')
img.save('/tmp/test.png')
text = pytesseract.image_to_string('/tmp/test.png')
print(f'OCR Result: {text.strip()}')
"

# Run comprehensive test
cd Docker && ./test-image-processing.sh
```

#### 6. **Ollama/LLM Integration Issues**

**Ollama Connection Problems:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags
ps aux | grep ollama

# Start Ollama if not running
ollama serve &

# Test Ollama models
ollama list
ollama pull llama3 # if no models installed

# Check application configuration
cat conf/config.ini | grep -A 5 "\[ai\]"

# Test from application
node -e "
const axios = require('axios');
axios.get('http://localhost:11434/api/tags')
  .then(res => console.log('Ollama OK:', res.data))
  .catch(err => console.error('Ollama Error:', err.message));
"
```

### 🔧 Advanced Debugging

#### Container Deep Dive
```bash
# Enter container for debugging
docker compose exec doc-workers sh
docker compose exec image-processor bash

# Check container resource usage
docker stats --no-stream

# Inspect container configuration
docker inspect productdemo-doc-workers
docker inspect productdemo-image-processor

# Check container logs with timestamps
docker compose logs -t doc-workers
docker compose logs -t image-processor
```

#### Network Debugging
```bash
# Check Docker network
docker network ls
docker network inspect docker_productdemo-network

# Test inter-container connectivity
docker compose exec doc-workers ping redis
docker compose exec doc-workers ping chromadb

# Check port bindings
docker port productdemo-redis
docker port productdemo-chromadb
```

#### Performance Debugging
```bash
# Monitor system resources
htop
docker stats

# Check disk usage
df -h
du -sh Docker/DATA/

# Monitor application performance
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:5634/api/health

# Database performance
psql -h localhost -U postgres -d copilot -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC LIMIT 10;
"
```

### 🚨 Emergency Recovery

#### Complete System Reset
```bash
# Stop all services
docker compose down

# Remove all containers and volumes
docker compose down -v
docker system prune -a

# Rebuild everything
docker compose build --no-cache
docker compose up -d

# Reinitialize database
npm run db:migrate
npm run db:migrate:queue
```

#### Data Recovery
```bash
# Backup current data
cp -r Docker/DATA/ Docker/DATA.backup.$(date +%Y%m%d)

# Restore from backup
cp -r Docker/DATA.backup.YYYYMMDD/ Docker/DATA/

# Reset ChromaDB collections
curl -X POST http://localhost:8001/api/v1/reset

# Reset Redis queues
docker compose exec redis redis-cli FLUSHALL
```

---

## 🚀 Production Deployment

### Pre-deployment Checklist
- [ ] PostgreSQL installed and configured on host
- [ ] Ollama installed and models downloaded
- [ ] Frontend built (`npm run build`)
- [ ] Database migrations applied
- [ ] Configuration files updated with production values
- [ ] SSL certificates configured (if needed)
- [ ] Firewall rules configured
- [ ] Backup strategy implemented

### Production Environment Setup

#### 1. System Preparation
```bash
# Install Node.js (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh
```

#### 2. Application Deployment
```bash
# Clone and setup application
git clone <repository-url> /opt/productdemo
cd /opt/productdemo

# Install dependencies
npm install
cd client && npm install && npm run build && cd ..

# Setup database
sudo -u postgres createdb productdemo
sudo -u postgres createuser productdemo_user
# Set password and permissions

# Run migrations
npm run db:migrate
npm run db:migrate:queue

# Start infrastructure services
cd Docker && docker compose up -d

# Start application (consider using PM2 for production)
npm install -g pm2
pm2 start src/server.js --name "productdemo"
pm2 startup
pm2 save
```

#### 3. Reverse Proxy Setup (Nginx)
```nginx
# /etc/nginx/sites-available/productdemo
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5634;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Security Considerations

1. **Database Security**
   - Use strong passwords
   - Restrict database access to localhost
   - Enable SSL connections

2. **Application Security**
   - Update `secret_key` in config
   - Enable HTTPS in production
   - Configure proper CORS origins

3. **Docker Security**
   - Keep Docker images updated
   - Use non-root users in containers
   - Limit container resources

4. **System Security**
   - Keep system packages updated
   - Configure firewall (ufw/iptables)
   - Regular security audits

### Backup Strategy

```bash
#!/bin/bash
# backup.sh - Production backup script

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/productdemo"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -h localhost -U productdemo_user productdemo > "$BACKUP_DIR/db_$DATE.sql"

# Application data backup
tar -czf "$BACKUP_DIR/data_$DATE.tar.gz" /opt/productdemo/DATA

# Redis backup (if needed)
docker exec productdemo-redis redis-cli BGSAVE
cp /var/lib/docker/volumes/docker_redis_data/_data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Scaling Considerations

#### Horizontal Scaling
```bash
# Scale document workers
cd Docker
docker compose up -d --scale doc-workers=10

# Scale application (requires load balancer)
# Run multiple instances on different ports
# Use Nginx/HAProxy for load balancing
```

#### Vertical Scaling
```bash
# Increase worker resources
# Edit docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '2.0'
```

---

## 📞 Support & Resources

### Architecture Summary

**What's Containerized:**
- ✅ Redis (Queue management)
- ✅ ChromaDB (Vector database)
- ✅ Document Workers (Processing)

**What's on Host:**
- ✅ Main Application (Backend + Frontend)
- ✅ PostgreSQL (Recommended)
- ✅ Ollama/LLM Services

**Why This Architecture:**
- **Performance**: Host services avoid container overhead
- **Simplicity**: Single port access, easier deployment
- **Flexibility**: Easy to scale workers independently
- **Development**: Faster iteration on main application code

## 🛠️ Docker Image Management

### Image Lifecycle Management

#### Building Images
```bash
# Build all custom images
cd Docker
docker compose build

# Build specific images
docker compose build doc-workers
docker compose build image-processor

# Force rebuild (ignore cache)
docker compose build --no-cache

# Build with specific tag
docker build -f Dockerfile.workers -t productdemo-doc-workers:v1.0 ..
docker build -f Dockerfile.image-processor -t productdemo-image-processor:v1.0 ..
```

#### Image Information & Inspection
```bash
# List all project images
docker images | grep productdemo

# Detailed image information
docker inspect productdemo-doc-workers
docker inspect productdemo-image-processor

# Image layer history and size
docker history productdemo-doc-workers
docker history productdemo-image-processor

# Image vulnerability scanning (if available)
docker scout cves productdemo-doc-workers
docker scout cves productdemo-image-processor
```

#### Image Updates & Maintenance
```bash
# Update base images
docker pull node:18-alpine3.16
docker pull python:3.9-slim
docker pull redis:7-alpine
docker pull chromadb/chroma:latest

# Rebuild after base image updates
docker compose build --pull

# Clean up old images
docker image prune
docker image prune -a  # Remove all unused images

# Remove specific images
docker rmi productdemo-doc-workers:old-tag
docker rmi productdemo-image-processor:old-tag
```

#### Image Registry Operations
```bash
# Tag images for registry
docker tag productdemo-doc-workers:latest your-registry.com/productdemo-doc-workers:v1.0
docker tag productdemo-image-processor:latest your-registry.com/productdemo-image-processor:v1.0

# Push to registry
docker push your-registry.com/productdemo-doc-workers:v1.0
docker push your-registry.com/productdemo-image-processor:v1.0

# Pull from registry
docker pull your-registry.com/productdemo-doc-workers:v1.0
docker pull your-registry.com/productdemo-image-processor:v1.0
```

### Container Management

#### Container Operations
```bash
# Start/stop specific services
docker compose up -d redis chromadb
docker compose stop doc-workers
docker compose restart image-processor

# Scale services
docker compose up -d --scale doc-workers=3

# View container details
docker compose ps
docker compose top doc-workers

# Container resource usage
docker stats productdemo-doc-workers
docker stats productdemo-image-processor
```

#### Container Debugging
```bash
# Execute commands in running containers
docker compose exec doc-workers sh
docker compose exec image-processor bash

# Run one-off commands
docker compose run --rm doc-workers node --version
docker compose run --rm image-processor python --version

# Copy files to/from containers
docker cp local-file.txt productdemo-doc-workers:/app/
docker cp productdemo-image-processor:/app/output.txt ./
```

#### Container Logs & Monitoring
```bash
# View logs
docker compose logs doc-workers
docker compose logs image-processor
docker compose logs -f --tail=100 doc-workers

# Follow logs from multiple services
docker compose logs -f doc-workers image-processor

# Export logs
docker compose logs doc-workers > worker-logs.txt
docker compose logs image-processor > processor-logs.txt
```

### Volume & Data Management

#### Volume Operations
```bash
# List volumes
docker volume ls | grep docker

# Inspect volume details
docker volume inspect docker_redis_data
docker volume inspect docker_image_collections

# Backup volumes
docker run --rm -v docker_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .
docker run --rm -v docker_image_collections:/data -v $(pwd):/backup alpine tar czf /backup/collections-backup.tar.gz -C /data .

# Restore volumes
docker run --rm -v docker_redis_data:/data -v $(pwd):/backup alpine tar xzf /backup/redis-backup.tar.gz -C /data
```

#### Data Directory Management
```bash
# Check data directory sizes
du -sh Docker/DATA/chroma_data/
du -sh Docker/DATA/documents/
du -sh Docker/DATA/embeddings/

# Backup data directories
tar czf data-backup-$(date +%Y%m%d).tar.gz Docker/DATA/

# Clean up old data (be careful!)
find Docker/DATA/documents/ -name "*.pdf" -mtime +30 -delete
find Docker/DATA/embeddings/ -name "*.json" -mtime +30 -delete
```

### Performance Optimization

#### Resource Limits
```yaml
# In docker-compose.yml
services:
  doc-workers:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2.0'
        reservations:
          memory: 1G
          cpus: '1.0'
```

#### Scaling Strategies
```bash
# Horizontal scaling for workers
docker compose up -d --scale doc-workers=5

# Monitor scaling effectiveness
docker stats $(docker ps -q --filter "name=doc-workers")

# Adjust based on load
docker compose up -d --scale doc-workers=2  # Scale down
```

### Quick Reference Commands

```bash
# === APPLICATION MANAGEMENT ===
npm start                        # Start main application
npm run dev                      # Development mode with auto-reload
cd client && npm run build       # Build frontend from client directory

# === DOCKER SERVICES ===
cd Docker && docker compose up -d              # Start all infrastructure
docker compose ps                              # Check service status
docker compose logs -f doc-workers            # View worker logs
docker compose up -d --scale doc-workers=5    # Scale workers
docker compose build --no-cache               # Rebuild all images

# === IMAGE MANAGEMENT ===
docker images | grep productdemo              # List project images
docker compose build doc-workers              # Build specific image
docker system prune -a                        # Clean up unused images
docker stats                                  # Monitor container resources

# === DATABASE MANAGEMENT ===
npm run db:migrate               # Run database migrations
npm run db:migrate:queue         # Apply queue schema
psql -h localhost -U postgres copilot         # Connect to database

# === MONITORING & HEALTH CHECKS ===
curl http://localhost:5634/api/health          # Application health
docker compose exec redis redis-cli ping       # Redis health
curl http://localhost:8001/api/v1/heartbeat   # ChromaDB health
docker compose logs -f doc-workers            # Monitor worker activity

# === TROUBLESHOOTING ===
docker compose down && docker compose up -d   # Restart all services
docker compose build --no-cache && docker compose up -d  # Full rebuild
./Docker/test-image-processing.sh             # Test image processor
```

### Getting Help

1. **Check Application Logs**: `tail -f logs/app.log`
2. **Verify Services**: `cd Docker && docker compose ps`
3. **Test Connectivity**: `curl http://localhost:5634/api/health`
4. **Check Configuration**: Review `conf/config.ini`
5. **Database Issues**: Test with `psql` connection
6. **Frontend Issues**: Rebuild with `cd client && npm run build`

---

## 🎯 Next Steps

After successful setup:

1. **Access Application**: http://localhost:5634
2. **Create Admin Account**: Use the frontend interface
3. **Upload Test Document**: Verify queue processing works
4. **Configure LLM Models**: Set up Ollama with required models
5. **Monitor Performance**: Check logs and resource usage
6. **Set Up Backups**: Implement automated backup strategy
7. **Scale Workers**: Adjust based on document processing load

---

---

## 📋 Complete Setup Summary

### 🏗️ Architecture Overview
This system uses a **hybrid containerization approach** with:

**Containerized Services (Docker):**
- ✅ **Redis** (`redis:7-alpine`) - Queue management on port 6379
- ✅ **ChromaDB** (`chromadb/chroma:latest`) - Vector database on port 8001
- ✅ **Document Workers** (Custom built) - Scalable document processing
- ✅ **Image Processor** (Custom built) - OCR and image extraction

**Host Services:**
- ✅ **Main Application** (Node.js + React) - Single port 5634
- ✅ **PostgreSQL** - Primary database on port 5432
- ✅ **Ollama/LLM** - AI model inference on port 11434

### 🐳 Docker Images Details

| Image | Type | Base | Size | Purpose |
|-------|------|------|------|---------|
| `productdemo-doc-workers` | Custom | `node:18-alpine` | ~800MB | Document processing, PDF parsing |
| `productdemo-image-processor` | Custom | `python:3.9-slim` | ~1.2GB | OCR, image extraction, multi-language |
| `redis:7-alpine` | Pre-built | Alpine Linux | ~30MB | Queue management, caching |
| `chromadb/chroma:latest` | Pre-built | Python | ~500MB | Vector database, embeddings |
| `postgres:15-alpine` | Pre-built | Alpine Linux | ~200MB | Optional database container |

### 🔧 Key Features

**Document Workers:**
- BullMQ-based queue processing
- PDF/DOCX parsing with PyMuPDF
- Embedding generation for RAG
- Horizontal scaling (1-10 instances)
- Python + Node.js hybrid environment

**Image Processor:**
- Tesseract OCR with 6 languages (EN, FR, DE, ES, IT, PT)
- PDF image extraction
- User-isolated collections
- ChromaDB integration
- Keyword-based image retrieval

**Infrastructure:**
- Redis with persistence and memory management
- ChromaDB with CORS and reset capabilities
- Automatic health checks and restart policies
- Resource limits and reservations

### 🚀 Quick Start Checklist

- [ ] **Prerequisites**: Docker, Node.js 18+, PostgreSQL
- [ ] **Clone Repository**: `git clone <repo> && cd c2s_integrate`
- [ ] **Install Dependencies**: `npm install && cd client && npm install && npm run build`
- [ ] **Configure Environment**: Copy and edit `conf/config.ini` and `.env`
- [ ] **Build Images**: `cd Docker && docker compose build`
- [ ] **Start Services**: `docker compose up -d`
- [ ] **Initialize Database**: `npm run db:migrate && npm run db:migrate:queue`
- [ ] **Start Application**: `npm start`
- [ ] **Verify Setup**: Access http://localhost:5634

### 🔍 Health Check URLs

| Service | Health Check | Expected Response |
|---------|-------------|-------------------|
| Main App | `curl http://localhost:5634/api/health` | `{"status": "ok"}` |
| Redis | `docker compose exec redis redis-cli ping` | `PONG` |
| ChromaDB | `curl http://localhost:8001/api/v1/heartbeat` | `{"nanosecond heartbeat": ...}` |
| Database | `psql -h localhost -U postgres -d copilot -c "SELECT 1;"` | `1` |
| Ollama | `curl http://localhost:11434/api/tags` | `{"models": [...]}` |

### 🛠️ Maintenance Commands

```bash
# Daily operations
docker compose up -d                    # Start services
npm start                              # Start main app
docker compose ps                      # Check status

# Updates and maintenance
docker compose pull                    # Update pre-built images
docker compose build --no-cache       # Rebuild custom images
docker system prune                   # Clean up unused resources

# Scaling and performance
docker compose up -d --scale doc-workers=3  # Scale workers
docker stats                               # Monitor resources
docker compose logs -f doc-workers        # Monitor activity

# Troubleshooting
./Docker/test-image-processing.sh      # Test image processor
docker compose down && docker compose up -d  # Restart all
```

### 📞 Support & Resources

**Documentation:**
- Main README: Project root directory
- Docker Setup: This file (`Docker/README.md`)
- API Documentation: Check `/api/docs` endpoint

**Troubleshooting:**
- Check service logs: `docker compose logs <service>`
- Verify connectivity: Use health check URLs above
- Test individual components: Use commands in troubleshooting section
- Reset system: `docker compose down -v && docker compose up -d`

---

*Last Updated: 2025-01-27*
*Version: 3.0.0 (Enhanced Docker Setup with Detailed Image Management)*

**Key Architecture Benefits:**
- 🎯 **Single Port Access**: Complete application via port 5634
- 🏗️ **Hybrid Approach**: Optimal performance with selective containerization
- 🐳 **Custom Images**: Tailored for document processing and OCR
- 🚀 **Scalable Design**: Independent scaling of processing components
- 📈 **Production Ready**: Comprehensive monitoring and maintenance tools
- 🔧 **Developer Friendly**: Easy setup, debugging, and iteration

For additional support, please check the project documentation or create an issue in the repository.

---

## 🗑️ Automatic File Cleanup

### Overview

The system automatically deletes uploaded PDF/DOC files after successful processing to save storage space. This feature:

- ✅ **Cross-platform compatible** (Windows, Linux, macOS)
- ✅ **Configurable** via settings
- ✅ **Safe** - only deletes after successful processing
- ✅ **Logged** for audit trails
- ✅ **Error-resistant** - cleanup failures don't affect processing

### Configuration

```ini
# conf/config.ini
[document_processing]
auto_cleanup_files = true          # Enable/disable automatic cleanup
cleanup_delay_seconds = 30         # Wait time before deletion (safety buffer)
keep_failed_files = true           # Keep files if processing failed
cleanup_log_level = info           # Logging level for cleanup operations
```

### How It Works

1. **Document Upload** → File stored in `DATA/documents/{userId}/`
2. **Processing** → Text extraction, chunking, embedding generation
3. **Success** → Wait 30 seconds, then delete original file
4. **Failure** → Keep file for debugging (configurable)

### Manual Cleanup Commands

```bash
# Clean up old processed files (older than 7 days)
node src/scripts/cleanup-processed-files.js --days=7

# Clean up specific user's files
node src/scripts/cleanup-processed-files.js --user-id=<userId>

# Clean up failed processing files
node src/scripts/cleanup-processed-files.js --failed-only

# Dry run (show what would be deleted)
node src/scripts/cleanup-processed-files.js --dry-run
```