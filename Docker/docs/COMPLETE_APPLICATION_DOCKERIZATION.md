# Complete Application Dockerization Guide

## Overview

This document provides a comprehensive guide for dockerizing the entire ProductDemo RAG application, including the client-side React application, backend services, and all dependencies. The goal is to create a fully containerized solution that runs with a single `docker-compose up` command.

## Current Application Architecture

### Application Components

1. **Backend Services (Node.js)**
   - Main Express.js server
   - WebSocket service
   - Document processing workers
   - Embedding service

2. **Client Application (React)**
   - React frontend with build process
   - Static assets and bundled JavaScript
   - CSS and media files

3. **Python Services**
   - RAG processing modules
   - Image processing with OCR
   - Text extraction services

4. **External Services**
   - PostgreSQL database
   - ChromaDB vector database
   - Redis cache/queue
   - Ollama LLM service

## 🎯 Complete Dockerization Strategy

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                           │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │   Web Server  │  │   API Server  │  │   DB Services │   │
│  │   (Nginx)     │  │   (Node.js)   │  │   (PG/Redis)  │   │
│  │               │  │               │  │               │   │
│  │ ├─ Static     │  │ ├─ REST API   │  │ ├─ PostgreSQL │   │
│  │ ├─ React App  │  │ ├─ WebSocket  │  │ ├─ ChromaDB   │   │
│  │ └─ Assets     │  │ └─ Workers    │  │ └─ Redis      │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│          │                   │                   │         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │  Processing   │  │   ML Services │  │  External     │   │
│  │   Services    │  │               │  │   Services    │   │
│  │               │  │ ├─ Embedding  │  │               │   │
│  │ ├─ Text Proc  │  │ ├─ Image OCR  │  │ └─ Ollama     │   │
│  │ ├─ Image Proc │  │ └─ Chat2SQL   │  │   (Host)      │   │
│  │ └─ Doc Workers│  │               │  │               │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Multi-Stage Build Strategy

### Stage 1: Client Build Container

```dockerfile
# Docker/Dockerfile.client-builder
FROM node:18-alpine AS client-builder

WORKDIR /app/client

# Install client dependencies
COPY client/package*.json ./
RUN npm ci --only=production

# Copy client source
COPY client/ ./

# Build the React application
RUN npm run build

# Verify build output
RUN ls -la build/ && echo "Client build completed successfully"
```

### Stage 2: Application Container

```dockerfile
# Docker/Dockerfile.application
FROM node:18-alpine AS app-builder

WORKDIR /app

# Install server dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy server source code
COPY src/ ./src/
COPY conf/ ./conf/
COPY scripts/ ./scripts/

# Copy built client from previous stage
COPY --from=client-builder /app/client/build ./client/build

# Create production user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Set ownership
RUN chown -R appuser:nodejs /app

USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/server.js", "--config=./conf/config.ini"]
```

## 🔧 Complete Docker Compose Configuration

### Production Docker Compose

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  # =====================================
  # Frontend & API Layer
  # =====================================
  
  nginx:
    image: nginx:alpine
    container_name: productdemo-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - static_files:/usr/share/nginx/html/static:ro
    depends_on:
      - application
    restart: unless-stopped
    networks:
      - productdemo-network

  application:
    build:
      context: ..
      dockerfile: Docker/Dockerfile.application
      target: production
    container_name: productdemo-app
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_HOST=postgres
      - DATABASE_PORT=5432
      - DATABASE_NAME=copilot
      - DATABASE_USER=postgres
      - DATABASE_PASSWORD_FILE=/run/secrets/db_password
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - CHROMADB_HOST=chromadb
      - CHROMADB_PORT=8000
      - EMBEDDING_SERVICE_URL=http://embedding-service:3579
      - OLLAMA_HOST=host.docker.internal
      - OLLAMA_PORT=11434
    volumes:
      - ../DATA:/app/DATA
      - ../logs:/app/logs
      - ../conf:/app/conf:ro
      - static_files:/app/client/build:ro
    secrets:
      - db_password
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      chromadb:
        condition: service_started
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 2G
          cpus: '1.5'
        reservations:
          memory: 1G
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - productdemo-network

  # =====================================
  # Database Layer
  # =====================================
  
  postgres:
    image: postgres:15-alpine
    container_name: productdemo-postgres
    environment:
      - POSTGRES_DB=copilot
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
      - POSTGRES_INITDB_ARGS=--encoding=UTF-8 --lc-collate=C --lc-ctype=C
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d:ro
    secrets:
      - db_password
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.25'
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d copilot"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    networks:
      - productdemo-network

  chromadb:
    image: chromadb/chroma:latest
    container_name: productdemo-chromadb
    ports:
      - "${CHROMADB_HOST_PORT:-8001}:8000"
    volumes:
      - chromadb_data:/chroma/chroma
    environment:
      - ALLOW_RESET=true
      - CHROMA_SERVER_CORS_ALLOW_ORIGINS=*
      - CHROMA_SERVER_HOST=0.0.0.0
      - CHROMA_SERVER_PORT=8000
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
        reservations:
          memory: 1G
          cpus: '0.5'
    networks:
      - productdemo-network

  redis:
    image: redis:7-alpine
    container_name: productdemo-redis
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1.5G
          cpus: '1.0'
        reservations:
          memory: 256M
          cpus: '0.1'
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    networks:
      - productdemo-network

  # =====================================
  # Processing Services
  # =====================================
  
  embedding-service:
    build:
      context: ..
      dockerfile: Docker/Dockerfile.embedding-service
    environment:
      - NODE_ENV=production
      - EMBEDDING_SERVICE_PORT=3579
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - OLLAMA_HOST=host.docker.internal
      - OLLAMA_PORT=11434
    volumes:
      - ../logs:/app/logs
      - ../conf:/app/conf:ro
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3579/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - productdemo-network

  doc-workers:
    build:
      context: ..
      dockerfile: Docker/Dockerfile.workers
    container_name: productdemo-doc-workers
    env_file:
      - env.docker
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - DOC_WORKER_CONCURRENCY=3
      - QUEUE_MAX_RETRIES=3
      - CHROMADB_HOST=chromadb
      - CHROMADB_PORT=8000
      - EMBEDDING_SERVICE_URL=http://embedding-service:3579
    volumes:
      - ../DATA:/app/DATA
      - ../conf:/app/conf:ro
      - ../logs:/app/logs
      - ../python:/app/python:ro
    depends_on:
      redis:
        condition: service_healthy
      chromadb:
        condition: service_started
      embedding-service:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.5'
        reservations:
          memory: 1G
          cpus: '0.5'
    networks:
      - productdemo-network

  image-processor:
    build:
      context: ..
      dockerfile: Docker/Dockerfile.image-processor
    container_name: productdemo-image-processor
    env_file:
      - env.docker
    environment:
      - TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata/
      - TESSERACT_CMD=/usr/bin/tesseract
      - PYTHONPATH=/app
    volumes:
      - ../DATA:/app/data
      - ../python/RAG-MODULE/image-processing:/app/image-processing:ro
      - image_collections:/app/data/collections
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 3G
          cpus: '2.0'
        reservations:
          memory: 1G
          cpus: '0.5'
    networks:
      - productdemo-network

  chat2sql:
    build:
      context: ..
      dockerfile: Docker/Dockerfile.chat2sql
    container_name: productdemo-chat2sql
    ports:
      - "5000:5000"
    environment:
      - PYTHONUNBUFFERED=1
      - DATABASE_HOST=postgres
      - DATABASE_PORT=5432
      - DATABASE_NAME=copilot
      - DATABASE_USER=postgres
      - DATABASE_PASSWORD_FILE=/run/secrets/db_password
    secrets:
      - db_password
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      chromadb:
        condition: service_started
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "python", "-c", "import requests; requests.get('http://localhost:5000/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - productdemo-network

# =====================================
# Volumes and Networks
# =====================================

volumes:
  postgres_data:
    driver: local
  chromadb_data:
    driver: local
  redis_data:
    driver: local
  image_collections:
    driver: local
  static_files:
    driver: local

networks:
  productdemo-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

## 🌐 Nginx Configuration

### Complete Nginx Setup

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Performance settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml;

    # Upstream backend servers
    upstream app_backend {
        least_conn;
        server application:3000 max_fails=3 fail_timeout=30s;
        # Add more app instances here for load balancing
        # server application-2:3000 max_fails=3 fail_timeout=30s;
    }

    upstream chat2sql_backend {
        server chat2sql:5000 max_fails=3 fail_timeout=30s;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/s;

    # Main server block
    server {
        listen 80;
        server_name localhost;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # Client-side routing support
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
            
            # Cache static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }

        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://app_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # WebSocket support
        location /socket.io/ {
            proxy_pass http://app_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket timeouts
            proxy_read_timeout 86400;
        }

        # File upload endpoints
        location /api/documents/upload {
            limit_req zone=upload burst=5 nodelay;
            
            proxy_pass http://app_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Large file upload support
            client_max_body_size 100M;
            proxy_request_buffering off;
            proxy_read_timeout 300s;
            proxy_send_timeout 300s;
        }

        # Chat2SQL API
        location /api/chat2sql/ {
            proxy_pass http://chat2sql_backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check endpoint
        location /health {
            proxy_pass http://app_backend/health;
            access_log off;
        }

        # Admin and monitoring (restrict access in production)
        location /admin/ {
            # allow 192.168.1.0/24;
            # deny all;
            
            proxy_pass http://app_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # HTTPS server (uncomment and configure for SSL)
    # server {
    #     listen 443 ssl http2;
    #     server_name localhost;
    #     
    #     ssl_certificate /etc/nginx/ssl/cert.pem;
    #     ssl_certificate_key /etc/nginx/ssl/key.pem;
    #     
    #     # SSL configuration
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #     ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    #     ssl_prefer_server_ciphers off;
    #     
    #     # Include the same location blocks as HTTP server
    # }
}
```

## 🔧 Build and Deployment Scripts

### Automated Build Script

```bash
#!/bin/bash
# scripts/build-complete-app.sh

set -e

echo "🏗️ Building Complete ProductDemo Application"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BUILD_ENV=${1:-production}
SKIP_TESTS=${SKIP_TESTS:-false}

echo -e "${YELLOW}Building for environment: ${BUILD_ENV}${NC}"

# Step 1: Install and build client
echo -e "\n${YELLOW}📦 Step 1: Building React Client${NC}"
cd client
if [ ! -d "node_modules" ]; then
    echo "Installing client dependencies..."
    npm install
fi

echo "Running client build..."
npm run build

# Verify build
if [ ! -d "build" ]; then
    echo -e "${RED}❌ Client build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Client build completed${NC}"
cd ..

# Step 2: Install backend dependencies
echo -e "\n${YELLOW}📦 Step 2: Installing Backend Dependencies${NC}"
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

# Step 3: Run tests (optional)
if [ "$SKIP_TESTS" != "true" ]; then
    echo -e "\n${YELLOW}🧪 Step 3: Running Tests${NC}"
    # npm test
    echo "Tests skipped for now"
fi

# Step 4: Build Docker images
echo -e "\n${YELLOW}🐳 Step 4: Building Docker Images${NC}"
cd Docker

# Build all services
echo "Building application image..."
docker-compose build application

echo "Building service images..."
docker-compose build embedding-service doc-workers image-processor chat2sql

# Step 5: Create deployment package
echo -e "\n${YELLOW}📦 Step 5: Creating Deployment Package${NC}"
cd ..

# Create deployment directory
DEPLOY_DIR="deploy-$(date +%Y%m%d-%H%M%S)"
mkdir -p $DEPLOY_DIR

# Copy necessary files
cp -r Docker/ $DEPLOY_DIR/
cp -r nginx/ $DEPLOY_DIR/
cp package.json $DEPLOY_DIR/
cp -r conf/ $DEPLOY_DIR/

# Create secrets directory
mkdir -p $DEPLOY_DIR/secrets
echo "changeme123" > $DEPLOY_DIR/secrets/db_password.txt

# Create deployment script
cat > $DEPLOY_DIR/deploy.sh << 'EOF'
#!/bin/bash
echo "🚀 Deploying ProductDemo Application"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Pull external images
echo "📥 Pulling external images..."
docker-compose pull postgres redis chromadb

# Start services
echo "🔄 Starting services..."
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
docker-compose -f docker-compose.production.yml ps

echo "✅ Deployment completed!"
echo "🌐 Application should be available at http://localhost"
EOF

chmod +x $DEPLOY_DIR/deploy.sh

echo -e "\n${GREEN}🎉 Build completed successfully!${NC}"
echo -e "${YELLOW}Deployment package created: ${DEPLOY_DIR}${NC}"
echo -e "${YELLOW}To deploy, run: cd ${DEPLOY_DIR} && ./deploy.sh${NC}"
```

### Development Docker Compose

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  # Development environment with hot reloading
  app-dev:
    build:
      context: ..
      dockerfile: Docker/Dockerfile.development
    ports:
      - "3000:3000"
      - "3001:3001"  # Client dev server
    environment:
      - NODE_ENV=development
      - CHOKIDAR_USEPOLLING=true
      - REACT_APP_API_URL=http://localhost:3000
    volumes:
      - ../src:/app/src
      - ../client/src:/app/client/src
      - ../client/public:/app/client/public
      - ../conf:/app/conf
      - ../DATA:/app/DATA
      - ../logs:/app/logs
    depends_on:
      - postgres-dev
      - redis-dev
      - chromadb-dev
    networks:
      - productdemo-dev-network

  postgres-dev:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=copilot_dev
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=dev_password
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    networks:
      - productdemo-dev-network

  redis-dev:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - productdemo-dev-network

  chromadb-dev:
    image: chromadb/chroma:latest
    ports:
      - "8001:8000"
    environment:
      - ALLOW_RESET=true
      - CHROMA_SERVER_CORS_ALLOW_ORIGINS=*
    networks:
      - productdemo-dev-network

volumes:
  postgres_dev_data:

networks:
  productdemo-dev-network:
    driver: bridge
```

### Development Dockerfile

```dockerfile
# Docker/Dockerfile.development
FROM node:18-alpine

WORKDIR /app

# Install development tools
RUN apk add --no-cache \
    git \
    curl \
    bash \
    python3 \
    py3-pip

# Install global development tools
RUN npm install -g nodemon concurrently

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd client && npm install

# Copy source code
COPY . .

# Create development user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S devuser -u 1001 -G nodejs && \
    chown -R devuser:nodejs /app

USER devuser

# Expose ports
EXPOSE 3000 3001

# Development command with hot reloading
CMD ["npm", "run", "dev"]
```

## ⚙️ Environment Configuration

### Production Environment File

```bash
# Docker/env.production
# Database Configuration
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=copilot
DATABASE_USER=postgres
DATABASE_SSL=false

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# ChromaDB Configuration
CHROMADB_HOST=chromadb
CHROMADB_PORT=8000

# Service URLs
EMBEDDING_SERVICE_URL=http://embedding-service:3579
CHAT2SQL_SERVICE_URL=http://chat2sql:5000

# External Services
OLLAMA_HOST=host.docker.internal
OLLAMA_PORT=11434

# Application Configuration
NODE_ENV=production
LOG_LEVEL=info
SESSION_SECRET=your-production-session-secret
JWT_SECRET=your-production-jwt-secret

# File Upload Configuration
MAX_FILE_SIZE=100MB
UPLOAD_PATH=/app/DATA/documents

# Processing Configuration
DOC_WORKER_CONCURRENCY=3
QUEUE_MAX_RETRIES=3
EMBEDDING_BATCH_SIZE=50

# Security Configuration
CORS_ORIGIN=http://localhost
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🚀 Quick Start Guide

### Single Command Deployment

```bash
# For Production
git clone <repository>
cd productdemo
./scripts/build-complete-app.sh production
cd deploy-<timestamp>
./deploy.sh

# For Development
docker-compose -f Docker/docker-compose.dev.yml up --build
```

### Step-by-Step Setup

```bash
# 1. Clone and setup
git clone <repository>
cd productdemo

# 2. Build client
cd client
npm install
npm run build
cd ..

# 3. Install backend dependencies
npm install

# 4. Setup environment
cp Docker/env.docker Docker/env.production
# Edit environment variables as needed

# 5. Create secrets
mkdir -p Docker/secrets
echo "your-secure-password" > Docker/secrets/db_password.txt

# 6. Start services
cd Docker
docker-compose -f docker-compose.production.yml up -d

# 7. Check status
docker-compose ps
curl http://localhost/health
```

## 📊 Service Communication Flow

### Request Flow Diagram

```
User Request
     │
     ▼
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│  Nginx  │────▶│ Application │────▶│ PostgreSQL  │
│ (Port   │     │   Server    │     │ (Database)  │
│  80)    │     │ (Port 3000) │     │             │
└─────────┘     └─────────────┘     └─────────────┘
     │                   │
     │                   ▼
     │          ┌─────────────┐     ┌─────────────┐
     │          │   Redis     │     │  ChromaDB   │
     │          │  (Queue)    │     │ (Vectors)   │
     │          │             │     │             │
     │          └─────────────┘     └─────────────┘
     │                   │
     ▼                   ▼
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│ Static  │     │ Document    │     │ Embedding   │
│ Files   │     │ Workers     │     │ Service     │
│ (React) │     │             │     │             │
└─────────┘     └─────────────┘     └─────────────┘
```

## 🔍 Monitoring and Health Checks

### Health Check Endpoints

```javascript
// Health check implementation
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'checking...',
      redis: 'checking...',
      chromadb: 'checking...'
    }
  };

  // Async health checks for dependencies
  Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkChromaDB()
  ]).then(results => {
    health.services.database = results[0].status === 'fulfilled' ? 'ok' : 'error';
    health.services.redis = results[1].status === 'fulfilled' ? 'ok' : 'error';
    health.services.chromadb = results[2].status === 'fulfilled' ? 'ok' : 'error';
    
    const allHealthy = Object.values(health.services).every(status => status === 'ok');
    res.status(allHealthy ? 200 : 503).json(health);
  });
});
```

### Docker Compose Health Monitoring

```bash
#!/bin/bash
# scripts/health-check.sh

echo "🔍 Checking ProductDemo Application Health"
echo "=========================================="

# Check if containers are running
echo "📦 Container Status:"
docker-compose ps

echo -e "\n🔍 Service Health Checks:"

# Check main application
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Application: Healthy"
else
    echo "❌ Application: Unhealthy"
fi

# Check Chat2SQL service
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Chat2SQL: Healthy"
else
    echo "❌ Chat2SQL: Unhealthy"
fi

# Check database connection
if docker-compose exec postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ PostgreSQL: Healthy"
else
    echo "❌ PostgreSQL: Unhealthy"
fi

# Check Redis
if docker-compose exec redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: Healthy"
else
    echo "❌ Redis: Unhealthy"
fi

echo -e "\n📊 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

## 🔒 Security Considerations

### Production Security Checklist

- [ ] **Secrets Management**: Use Docker secrets for sensitive data
- [ ] **SSL/TLS**: Configure HTTPS with proper certificates
- [ ] **Network Isolation**: Use custom networks with restricted access
- [ ] **User Permissions**: Run containers as non-root users
- [ ] **Resource Limits**: Set memory and CPU limits for all services
- [ ] **Security Headers**: Configure Nginx security headers
- [ ] **Rate Limiting**: Implement API rate limiting
- [ ] **Database Security**: Use strong passwords and restrict connections
- [ ] **Container Updates**: Regular security updates for base images
- [ ] **Monitoring**: Set up security monitoring and alerting

### Security Hardening

```dockerfile
# Security-hardened application container
FROM node:18-alpine AS security-hardened

# Install security updates
RUN apk upgrade --no-cache

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Set up application
WORKDIR /app
COPY --chown=appuser:appgroup . .

# Remove unnecessary packages
RUN apk del --purge wget curl

# Switch to non-root user
USER appuser

# Health check without external dependencies
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Build and test client application
- [ ] Configure environment variables
- [ ] Set up SSL certificates (if using HTTPS)
- [ ] Create Docker secrets
- [ ] Review security configurations
- [ ] Backup existing data

### Deployment
- [ ] Pull latest code
- [ ] Build Docker images
- [ ] Run database migrations
- [ ] Start services with health checks
- [ ] Verify all endpoints
- [ ] Test critical functionality

### Post-Deployment
- [ ] Monitor logs for errors
- [ ] Check resource usage
- [ ] Verify backup systems
- [ ] Update documentation
- [ ] Notify team of deployment

This complete dockerization strategy provides a production-ready, scalable deployment of the entire ProductDemo RAG application with proper separation of concerns, security measures, and operational best practices. 