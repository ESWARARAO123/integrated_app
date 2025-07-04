# Complete Dockerization Guide

## Overview

This guide explains how the ProductDemo application has been fully dockerized, providing a comprehensive walkthrough of the containerization strategy, implementation details, and best practices used to create a production-ready multi-service architecture.

## Dockerization Strategy

### 1. Service Decomposition

The application has been decomposed into specialized microservices, each with a specific responsibility:

- **Data Layer**: ChromaDB (vector database) + Redis (queue/cache)
- **Processing Layer**: Document Workers + Image Processor
- **API Layer**: Embedding Service + Chat2SQL Service
- **Application Layer**: Main Node.js application (not shown in docker-compose)

### 2. Container Design Principles

#### Single Responsibility Principle
Each container handles one specific function:
- Document processing
- Image OCR
- Embedding generation
- SQL query generation

#### Stateless Design
Most services are designed to be stateless:
- Configuration via environment variables
- Data persistence through volumes
- No local state storage in containers

#### Resource Optimization
- Multi-stage builds where applicable
- Alpine Linux base images for smaller footprint
- Specific resource limits and reservations

## Dockerfile Analysis

### 1. Embedding Service Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app

# System dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    curl \
    bash

# Application setup
COPY package*.json ./
RUN npm ci --only=production

# Source code
COPY src/services/embeddingService/ ./src/services/embeddingService/
COPY src/utils/ ./src/utils/
COPY conf/ ./conf/

# Security: Non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S embeddinguser -u 1001
RUN chown -R embeddinguser:nodejs /app
USER embeddinguser

EXPOSE 3579
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3579/health || exit 1

CMD ["node", "src/services/embeddingService/server.js"]
```

**Key Features**:
- **Base Image**: Node.js 18 Alpine for minimal footprint
- **Dependencies**: Only production dependencies installed
- **Security**: Non-root user execution
- **Health Checks**: Built-in health monitoring
- **Port Exposure**: Single port for service communication

### 2. Document Workers Dockerfile

```dockerfile
FROM node:18-alpine3.16
WORKDIR /app

# Multi-language support
RUN apk add --no-cache \
    bash curl imagemagick poppler-utils \
    build-base libffi-dev openssl-dev \
    python3 python3-dev py3-pip \
    && ln -sf python3 /usr/bin/python

# Python virtual environment
RUN python3 -m venv /app/python/.venv
COPY python/requirements.txt /app/python/requirements.txt
RUN /app/python/.venv/bin/pip install --upgrade pip && \
    /app/python/.venv/bin/pip install --no-cache-dir -r /app/python/requirements.txt

# Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Application code
COPY src ./src
COPY conf ./conf

# Directory structure
RUN mkdir -p /app/DATA/documents \
    && mkdir -p /app/DATA/embeddings \
    && mkdir -p /app/DATA/vector_store \
    && mkdir -p /app/logs

# Permissions and security
RUN chmod +x /app/python/.venv/bin/* && \
    chown -R node:node /app
USER node

# Environment setup
ENV PATH="/app/python/.venv/bin:$PATH"
ENV PYTHONPATH="/app/python/.venv/lib/python3.9/site-packages"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "const redis = require('ioredis'); const client = new redis(process.env.REDIS_HOST, process.env.REDIS_PORT); client.ping().then(() => process.exit(0)).catch(() => process.exit(1));"

CMD ["node", "src/workers/documentWorker.js"]
```

**Key Features**:
- **Multi-language**: Node.js + Python integration
- **Virtual Environment**: Isolated Python dependencies
- **Document Processing**: ImageMagick and Poppler for file handling
- **Health Monitoring**: Redis connectivity check
- **Resource Management**: Proper directory structure and permissions

### 3. Image Processor Dockerfile

```dockerfile
FROM python:3.9-slim as base

# OCR Dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr tesseract-ocr-eng tesseract-ocr-fra \
    tesseract-ocr-deu tesseract-ocr-spa tesseract-ocr-ita \
    tesseract-ocr-por libtesseract-dev libleptonica-dev \
    pkg-config libpoppler-cpp-dev libmagic1 \
    libffi-dev libssl-dev build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Security
RUN groupadd -r imageprocessor && useradd -r -g imageprocessor imageprocessor

# Python dependencies
COPY python/RAG-MODULE/image-processing/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Application code
COPY python/RAG-MODULE/image-processing/ /app/image-processing/

# Directory setup
RUN mkdir -p /app/data/input /app/data/output /app/data/collections && \
    chown -R imageprocessor:imageprocessor /app

# OCR Configuration
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata/
ENV TESSERACT_CMD=/usr/bin/tesseract

USER imageprocessor

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD tesseract --version || exit 1

CMD ["tail", "-f", "/dev/null"]
```

**Key Features**:
- **OCR Support**: Tesseract with multiple languages
- **Document Processing**: Poppler for PDF handling
- **Security**: Dedicated user for image processing
- **Multi-language OCR**: Support for 6+ languages
- **Health Monitoring**: Tesseract availability check

### 4. Chat2SQL Dockerfile

```dockerfile
FROM python:3.9-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY python/CHAT2SQL-MODULE/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY python/CHAT2SQL-MODULE/backend.py .

# Security
RUN useradd --create-home --shell /bin/bash chat2sql
RUN chown -R chat2sql:chat2sql /app
USER chat2sql

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:5000/')" || exit 1

CMD ["uvicorn", "backend:app", "--host", "0.0.0.0", "--port", "5000"]
```

**Key Features**:
- **FastAPI/Uvicorn**: Modern Python web framework
- **Database Support**: PostgreSQL connectivity
- **Security**: Non-root user execution
- **Health Monitoring**: HTTP endpoint check
- **Production Ready**: Uvicorn ASGI server

## Docker Compose Configuration

### Service Orchestration

The `docker-compose.yml` file orchestrates all services with proper:

1. **Dependency Management**: Services start in correct order
2. **Network Configuration**: Isolated networks for security
3. **Volume Management**: Persistent data storage
4. **Environment Configuration**: Centralized configuration
5. **Resource Limits**: Prevent resource exhaustion
6. **Health Monitoring**: Service availability checks

### Network Architecture

```yaml
networks:
  productdemo-network:
    driver: bridge
```

**Network Modes Used**:
- **Bridge Network**: Default for most services (ChromaDB, Redis, Image Processor, Chat2SQL)
- **Host Network**: For embedding-service and doc-workers (performance optimization)

### Volume Strategy

```yaml
volumes:
  redis_data:
    driver: local
  image_collections:
    driver: local
```

**Volume Types**:
1. **Named Volumes**: For service-specific data (redis_data, image_collections)
2. **Bind Mounts**: For shared application data and configuration
3. **Anonymous Volumes**: Not used (avoided for data persistence)

## Environment Configuration

### Configuration Hierarchy

1. **docker-compose.yml**: Service-level environment variables
2. **env.docker**: Shared environment configuration
3. **Application Config**: Runtime configuration files

### Key Configuration Areas

```bash
# Service Discovery
REDIS_HOST=localhost
CHROMADB_HOST=localhost
EMBEDDING_SERVICE_URL=http://localhost:3579

# Resource Configuration
DOC_WORKER_CONCURRENCY=3
QUEUE_MAX_RETRIES=3

# External Dependencies
OLLAMA_HOST=localhost
OLLAMA_PORT=11434

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

## Build Process

### Multi-Stage Builds

Where applicable, multi-stage builds are used to:
- Reduce final image size
- Separate build dependencies from runtime
- Improve security by excluding build tools

### Build Context Optimization

```yaml
build:
  context: ..
  dockerfile: Docker/Dockerfile.embedding-service
```

**Build Context Strategy**:
- **Parent Directory**: Access to application source code
- **Specific Dockerfiles**: Service-specific build instructions
- **Minimal Context**: Only necessary files copied

### Dependency Management

#### Node.js Services
```dockerfile
COPY package*.json ./
RUN npm ci --only=production
```

#### Python Services
```dockerfile
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
```

**Best Practices**:
- Lock file usage (package-lock.json, requirements.txt)
- Production-only dependencies
- Layer caching optimization

## Security Implementation

### Container Security

1. **Non-Root Users**: All services run as dedicated users
2. **Resource Limits**: CPU and memory constraints
3. **Read-Only Filesystems**: Where possible
4. **Minimal Base Images**: Alpine/slim variants

### Network Security

1. **Network Isolation**: Services communicate through defined networks
2. **Port Exposure**: Only necessary ports exposed
3. **Internal Communication**: Container-to-container communication preferred

### Data Security

1. **Volume Permissions**: Proper file system permissions
2. **Secret Management**: Environment variable based (can be improved)
3. **Configuration Isolation**: Separate configuration files

## Monitoring and Observability

### Health Checks

Each service implements appropriate health checks:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3579/health || exit 1
```

**Health Check Types**:
- **HTTP Endpoints**: Web services
- **Command Execution**: CLI tools (Redis, Tesseract)
- **Custom Scripts**: Application-specific checks

### Logging Strategy

```yaml
volumes:
  - ../logs:/app/logs
```

**Logging Features**:
- **Centralized Logs**: All services log to shared directory
- **Structured Logging**: JSON format for parsing
- **Log Rotation**: Handled by application or external tools

### Resource Monitoring

```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '1.0'
    reservations:
      memory: 512M
      cpus: '0.5'
```

## Deployment Process

### Development Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Scale specific services
docker-compose up -d --scale doc-workers=3
```

### Production Deployment

```bash
# Build and start in production mode
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Health check
docker-compose ps

# Monitor resources
docker stats
```

### Service Management

```bash
# Restart specific service
docker-compose restart embedding-service

# Update service
docker-compose up -d --no-deps embedding-service

# View service logs
docker-compose logs -f doc-workers
```

## Data Management

### Backup Strategy

```bash
# Backup volumes
docker run --rm -v productdemo_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis_backup.tar.gz -C /data .

# Backup bind mounts
tar czf data_backup.tar.gz DATA/ logs/ conf/
```

### Data Migration

```bash
# Export data
docker-compose exec chromadb chroma utils export --path /backup

# Import data
docker-compose exec chromadb chroma utils import --path /backup
```

## Performance Optimization

### Image Optimization

1. **Multi-stage builds**: Reduce final image size
2. **Layer caching**: Optimize Dockerfile layer order
3. **Base image selection**: Alpine vs. slim vs. full

### Runtime Optimization

1. **Resource limits**: Prevent resource contention
2. **Health check intervals**: Balance monitoring vs. overhead
3. **Network mode selection**: Host vs. bridge based on needs

### Storage Optimization

1. **Volume drivers**: Local vs. network storage
2. **Bind mount performance**: Consider volume mounts for better performance
3. **Cleanup strategies**: Regular cleanup of unused volumes/images

## Troubleshooting Guide

### Common Issues

1. **Port Conflicts**: Check for conflicting host ports
2. **Volume Permissions**: Ensure proper file permissions
3. **Network Connectivity**: Verify inter-service communication
4. **Resource Limits**: Monitor memory/CPU usage

### Debugging Commands

```bash
# Service status
docker-compose ps

# Service logs
docker-compose logs service-name

# Execute commands in container
docker-compose exec service-name bash

# Network inspection
docker network ls
docker network inspect productdemo_productdemo-network

# Volume inspection
docker volume ls
docker volume inspect productdemo_redis_data
```

## Best Practices Summary

### Dockerfile Best Practices

1. **Use specific base image tags**
2. **Minimize layers and image size**
3. **Use multi-stage builds when appropriate**
4. **Run as non-root user**
5. **Include health checks**
6. **Use .dockerignore files**

### Docker Compose Best Practices

1. **Use environment files for configuration**
2. **Implement proper dependency management**
3. **Use named volumes for persistent data**
4. **Implement resource limits**
5. **Use networks for service isolation**
6. **Include health checks and restart policies**

### Security Best Practices

1. **Run containers as non-root users**
2. **Use read-only root filesystems where possible**
3. **Implement proper secret management**
4. **Regularly update base images**
5. **Use minimal base images**
6. **Implement network segmentation**

This dockerization approach provides a solid foundation for a production-ready, scalable RAG system with proper separation of concerns, security measures, and operational considerations. 