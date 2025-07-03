# Docker Architecture Documentation

## Overview

This document provides a comprehensive analysis of the ProductDemo Docker architecture, which implements a scalable RAG (Retrieval-Augmented Generation) system with multiple specialized services for document processing, image analysis, and conversational AI.

## Architecture Summary

The system consists of **6 containerized services** working together to provide a complete RAG solution:

1. **ChromaDB** - Vector database for embeddings storage
2. **Redis** - Message queue and caching layer
3. **Embedding Service** - Dedicated embedding generation service
4. **Document Workers** - Document processing and chunking
5. **Image Processor** - OCR and image analysis
6. **Chat2SQL** - Natural language to SQL conversion

## Service Details

### 1. ChromaDB Service
- **Image**: `chromadb/chroma:latest`
- **Container Name**: `productdemo-chromadb`
- **Port**: 8001:8000 (host:container)
- **Purpose**: Vector database for storing and retrieving document embeddings
- **Key Features**:
  - CORS enabled for web access
  - Reset functionality enabled
  - Persistent data storage via volume mapping
  - Network: `productdemo-network`

**Configuration**:
```yaml
environment:
  - ALLOW_RESET=true
  - CHROMA_SERVER_CORS_ALLOW_ORIGINS=*
  - CHROMA_SERVER_HOST=0.0.0.0
  - CHROMA_SERVER_PORT=8000
```

### 2. Redis Service
- **Image**: `redis:7-alpine`
- **Container Name**: `productdemo-redis`
- **Port**: 6379:6379 (host:container)
- **Purpose**: Message queue for job processing and caching
- **Key Features**:
  - Persistent data with append-only file
  - Memory optimization (512MB limit with LRU eviction)
  - Health checks for service reliability
  - Network: `productdemo-network`

**Configuration**:
```bash
redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### 3. Embedding Service
- **Build**: Custom Node.js Alpine image
- **Network Mode**: Host networking
- **Port**: 3579
- **Purpose**: Dedicated microservice for generating text embeddings
- **Key Features**:
  - Node.js 18 Alpine base for lightweight footprint
  - Integrates with Ollama for local LLM inference
  - Health checks and automatic restarts
  - Resource limits: 1GB RAM, 1 CPU

**Dependencies**:
- Redis (healthy state required)
- Ollama service (external, port 11434)

### 4. Document Workers
- **Build**: Custom Node.js Alpine with Python integration
- **Container Name**: `productdemo-doc-workers`
- **Network Mode**: Host networking
- **Purpose**: Process documents, extract text, and create embeddings
- **Key Features**:
  - Multi-language support (Node.js + Python)
  - Document processing pipeline
  - Queue-based job processing
  - Concurrent processing (3 workers)
  - Resource limits: 1GB RAM, 1 CPU

**Processing Capabilities**:
- PDF text extraction
- Document chunking
- Embedding generation
- Vector store integration

### 5. Image Processor
- **Build**: Custom Python image with OCR support
- **Container Name**: `productdemo-image-processor`
- **Purpose**: Extract text from images using OCR
- **Key Features**:
  - Tesseract OCR with multiple language support
  - Image format support (PDF, PNG, JPG, etc.)
  - Multi-language OCR (English, French, German, Spanish, Italian, Portuguese)
  - Resource limits: 2GB RAM, 1.5 CPU
  - Network: `productdemo-network`

**OCR Languages Supported**:
- English (eng)
- French (fra)
- German (deu)
- Spanish (spa)
- Italian (ita)
- Portuguese (por)

### 6. Chat2SQL Service
- **Build**: Custom Python image
- **Container Name**: `productdemo-chat2sql`
- **Port**: 5000:5000
- **Purpose**: Convert natural language queries to SQL
- **Key Features**:
  - FastAPI/Uvicorn server
  - Integration with external database
  - Health monitoring
  - Resource limits: 1GB RAM, 1 CPU
  - Network: `productdemo-network`

## Network Architecture

### Network Configuration
- **Primary Network**: `productdemo-network` (bridge driver)
- **Host Networking**: Used by embedding-service and doc-workers for performance
- **Service Discovery**: Container names used for inter-service communication

### Port Mapping
| Service | Host Port | Container Port | Protocol |
|---------|-----------|----------------|----------|
| ChromaDB | 8001 | 8000 | HTTP |
| Redis | 6379 | 6379 | TCP |
| Embedding Service | 3579 | 3579 | HTTP |
| Chat2SQL | 5000 | 5000 | HTTP |

## Data Persistence

### Volume Mappings
1. **ChromaDB Data**: `./DATA/chroma_data:/chroma/chroma`
2. **Redis Data**: `redis_data:/data` (named volume)
3. **Application Data**: `../DATA:/app/DATA` (shared across services)
4. **Configuration**: `../conf:/app/conf` (shared configuration)
5. **Logs**: `../logs:/app/logs` (centralized logging)
6. **Image Collections**: `image_collections:/app/data/collections` (named volume)

### Named Volumes
- `redis_data`: Persistent Redis storage
- `image_collections`: Image processing collections

## Service Dependencies

### Dependency Chain
```
Redis (base service)
├── ChromaDB (independent)
├── Embedding Service (depends on Redis)
├── Document Workers (depends on Redis, ChromaDB, Embedding Service)
├── Image Processor (independent)
└── Chat2SQL (depends on Redis, ChromaDB)
```

### Health Checks
- **Redis**: `redis-cli ping`
- **Embedding Service**: `curl -f http://localhost:3579/health`
- **Chat2SQL**: Python health check via requests
- **Image Processor**: `tesseract --version`

## Resource Allocation

### Memory Allocation
| Service | Reserved | Limit | Purpose |
|---------|----------|-------|---------|
| Embedding Service | 512MB | 1GB | Text embedding generation |
| Document Workers | 512MB | 1GB | Document processing |
| Image Processor | 1GB | 2GB | OCR processing (memory intensive) |
| Chat2SQL | 512MB | 1GB | SQL generation |
| Redis | N/A | 512MB | In-memory cache/queue |
| ChromaDB | N/A | N/A | Vector storage |

### CPU Allocation
| Service | Reserved | Limit |
|---------|----------|-------|
| Embedding Service | 0.5 | 1.0 |
| Document Workers | 0.5 | 1.0 |
| Image Processor | 0.5 | 1.5 |
| Chat2SQL | 0.5 | 1.0 |

**Total Resource Requirements**:
- **Memory**: ~6GB (including OS overhead)
- **CPU**: ~5.5 cores
- **Storage**: Variable (depends on document volume)

## Scalability Features

### Current Scalability
1. **Document Workers**: Configurable concurrency (DOC_WORKER_CONCURRENCY=3)
2. **Queue-based Processing**: Redis-backed job queues for async processing
3. **Resource Limits**: Prevents resource exhaustion
4. **Health Monitoring**: Automatic service recovery

### Horizontal Scaling Potential
1. **Embedding Service**: Can be scaled with load balancer
2. **Document Workers**: Can run multiple replicas
3. **Image Processor**: Stateless, easily scalable
4. **Chat2SQL**: Can handle multiple instances

### Vertical Scaling
- Resource limits can be adjusted based on workload
- Memory and CPU allocations are configurable
- Storage volumes can be expanded

## Security Features

### Container Security
1. **Non-root Users**: All custom services run as non-root users
2. **Resource Limits**: Prevent resource exhaustion attacks
3. **Network Isolation**: Services communicate through defined networks
4. **Volume Permissions**: Proper file system permissions

### Access Control
1. **Redis Password**: Optional password protection
2. **CORS Configuration**: Controlled cross-origin access for ChromaDB
3. **Health Check Endpoints**: Monitoring without exposing internal APIs

## Monitoring and Observability

### Health Checks
- **Interval**: 30 seconds for most services
- **Timeout**: 10 seconds
- **Retries**: 3-5 attempts before marking unhealthy
- **Start Period**: 30-40 seconds for service initialization

### Logging
- **Centralized Logs**: All services log to `../logs` directory
- **Log Levels**: Configurable via environment variables
- **Structured Logging**: JSON format for parsing

### Metrics Collection
- Health check status
- Resource utilization
- Queue depth (Redis)
- Processing times

## Environment Configuration

### Key Environment Variables
```bash
# Service Ports
CHROMADB_HOST_PORT=8001
REDIS_HOST_PORT=6379
EMBEDDING_SERVICE_PORT=3579

# Processing Configuration
DOC_WORKER_CONCURRENCY=3
QUEUE_MAX_RETRIES=3

# External Services
OLLAMA_HOST=localhost
OLLAMA_PORT=11434

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=copilot
```

## Data Flow

### Document Processing Pipeline
1. **Document Upload** → Document Workers
2. **Text Extraction** → Document Workers
3. **Chunking** → Document Workers
4. **Embedding Generation** → Embedding Service
5. **Vector Storage** → ChromaDB
6. **Image Processing** → Image Processor (parallel)

### Query Processing Pipeline
1. **User Query** → Chat2SQL / Main Application
2. **Query Embedding** → Embedding Service
3. **Vector Search** → ChromaDB
4. **Context Retrieval** → Document Workers
5. **Response Generation** → LLM Service (Ollama)

## Performance Characteristics

### Throughput
- **Document Processing**: ~10-50 documents/minute (depending on size)
- **Embedding Generation**: ~100-500 chunks/minute
- **Query Response**: <2 seconds for typical queries

### Latency
- **Embedding Service**: <100ms per request
- **Vector Search**: <50ms per query
- **OCR Processing**: 1-10 seconds per image

## Deployment Considerations

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- 8GB+ RAM recommended
- 4+ CPU cores recommended
- 50GB+ storage for data

### Startup Sequence
1. Redis starts first (base dependency)
2. ChromaDB starts independently
3. Embedding Service waits for Redis health
4. Document Workers wait for all dependencies
5. Other services start based on their dependencies

### Configuration Files
- `docker-compose.yml`: Service definitions
- `env.docker`: Environment variables
- Individual Dockerfiles for custom services
- Application configuration in `../conf/`

This architecture provides a robust, scalable foundation for a RAG system with clear separation of concerns and horizontal scaling capabilities. 