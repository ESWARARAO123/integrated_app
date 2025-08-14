# Docker Architecture Documentation

## Overview

PinnacleAi uses a comprehensive Docker-based microservices architecture that orchestrates multiple specialized services for AI-powered document processing, chat functionality, and prediction capabilities.

## Docker Compose Architecture

### Service Topology

```
Host Machine (172.16.16.23)
├── PostgreSQL Database
├── Ollama AI Service
└── File System Storage
    │
    └── Docker Network (productdemo-network)
        ├── Infrastructure Services
        │   ├── ChromaDB (Vector Database) :8001
        │   └── Redis (Cache/Queue) :6379
        │
        ├── Processing Services
        │   ├── Embedding Service :3579
        │   ├── Text Processor :3580
        │   ├── Image Processor :8430
        │   └── MCP Orchestrator :3581
        │
        ├── Application Services
        │   ├── Main App (Node.js) :5641
        │   └── Document Workers (Background)
        │
        └── Analysis Services
            ├── Chat2SQL :5000
            └── RunStatus :5003
```

## Service Definitions

### 1. Infrastructure Services

#### ChromaDB (`chromadb`)
```yaml
image: chromadb/chroma:latest
ports: 8001:8000
purpose: Vector database for document embeddings
volumes: ./DATA/chroma_data:/chroma/chroma
```

**Responsibilities**:
- Store document embeddings
- Semantic search capabilities
- Vector similarity matching
- Document retrieval for chat context

#### Redis (`redis`)
```yaml
image: redis:7-alpine
ports: 6379:6379
purpose: Session storage and job queues
volumes: redis_data:/data
```

**Responsibilities**:
- Session management
- Background job queues
- Caching layer
- Inter-service communication

### 2. Processing Services

#### Embedding Service (`embedding-service`)
```yaml
build: Dockerfile.embedding-service
ports: 3579:3579
purpose: Generate text embeddings
```

**Responsibilities**:
- Convert text to vector embeddings
- Integration with Ollama models
- Batch processing of documents
- Embedding model management

#### Text Processor (`text-processor`)
```yaml
build: Dockerfile.text-processor
ports: 3580:3580
purpose: Extract text from documents
```

**Responsibilities**:
- Text extraction from various formats
- Content preprocessing
- Format normalization
- Metadata extraction

#### Image Processor (`image-processor`)
```yaml
build: Dockerfile.image-processor
ports: 8430:8430
purpose: Process images and visual content
```

**Responsibilities**:
- Image analysis and processing
- OCR capabilities
- Visual content extraction
- Image format conversion

#### MCP Orchestrator (`mcp-orchestrator`)
```yaml
build: Dockerfile.mcp-orchestrator
ports: 3581:3581
purpose: Model Context Protocol management
```

**Responsibilities**:
- AI model coordination
- Context management
- Protocol handling
- Model switching

### 3. Application Services

#### Main Application (`app`)
```yaml
build: Dockerfile.app
ports: 5641:5641
purpose: Primary application server
```

**Responsibilities**:
- Express.js web server
- React frontend serving
- API route management
- WebSocket server
- Authentication & authorization
- Settings management (including prediction DB)

**Key Features**:
- Serves React frontend from `/client/build`
- API routes under `/api` prefix
- WebSocket support for real-time features
- Session-based authentication
- Integration with all other services

#### Document Workers (`doc-workers`)
```yaml
build: Dockerfile.workers
purpose: Background document processing
```

**Responsibilities**:
- Process uploaded documents
- Generate embeddings
- Update databases
- Handle processing queues

### 4. Analysis Services

#### Chat2SQL (`chat2sql`)
```yaml
build: Dockerfile.chat2sql
ports: 5000:5000
purpose: Natural language to SQL conversion
```

**Responsibilities**:
- Convert natural language to SQL queries
- Database query generation
- Query optimization
- Result formatting

#### RunStatus (`runstatus`)
```yaml
build: Dockerfile.runstatus
ports: 5003:5003
purpose: Analysis run tracking
```

**Responsibilities**:
- Track analysis runs
- Monitor processing status
- Progress reporting
- Status visualization

## Network Architecture

### Docker Network Configuration
```yaml
networks:
  productdemo-network:
    driver: bridge
```

### Host Integration
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

**Host Services**:
- **PostgreSQL**: Main application database
- **Ollama**: AI model service
- **File System**: Persistent storage

### Service Communication

#### Internal Communication (Docker Network)
```
app → chromadb:8000
app → redis:6379
app → embedding-service:3579
app → text-processor:3580
app → image-processor:8430
app → mcp-orchestrator:3581
```

#### External Communication (Host)
```
app → host.docker.internal:5432 (PostgreSQL)
app → host.docker.internal:11434 (Ollama)
```

## Volume Management

### Persistent Volumes
```yaml
volumes:
  redis_data:           # Redis persistence
  embedding_models:     # Model storage
```

### Bind Mounts
```yaml
../DATA:/app/DATA                 # Application data
../logs:/app/logs                 # Application logs
../conf:/app/conf                 # Configuration files
../python:/app/python             # Python modules
../assets:/app/assets             # Static assets
```

## Environment Configuration

### Service Discovery
```bash
REDIS_HOST=redis
CHROMADB_URL=http://chromadb:8000
EMBEDDING_SERVICE_URL=http://embedding-service:3579
TEXT_PROCESSOR_URL=http://text-processor:3580
MCP_ORCHESTRATOR_URL=http://mcp-orchestrator:3581
IMAGE_PROCESSOR_URL=http://image-processor:8430
```

### Host Integration
```bash
DATABASE_HOST=172.16.16.23        # PostgreSQL on host
OLLAMA_HOST=172.16.16.23          # Ollama on host
HOST_MACHINE_IP=172.16.16.23      # Host IP for services
```

## Configuration Management

### Docker-Specific Configuration
- **`Docker/config.docker.ini`**: Docker environment settings
- **`Docker/env.docker`**: Environment variables
- **`Docker/docker-compose.yml`**: Service orchestration

### Configuration Flow
```
Host config.ini → Docker config.docker.ini → Container /app/conf/config.ini
```

## Deployment Process

### 1. Build Process
```bash
./Docker/run.sh
```

### 2. Service Startup Order
```
1. Infrastructure: ChromaDB, Redis
2. Processing: Embedding, Text, Image, MCP services
3. Application: Main app, Workers
4. Analysis: Chat2SQL, RunStatus
```

### 3. Health Checks
- Service readiness verification
- Database connectivity tests
- Inter-service communication validation

## Data Flow Architecture

### Document Processing Flow
```
User Upload → App → Text Processor → Embedding Service → ChromaDB
                 ↓
            Doc Workers → PostgreSQL (metadata)
```

### Chat Interaction Flow
```
User Message → App → Ollama (Host) → AI Response
                  ↓
            Context Retrieval ← ChromaDB
```

### Prediction Workflow
```
User Config → App Settings → Prediction DB (PostgreSQL)
                          ↓
            Prediction Module → External PostgreSQL → Results
```

## Scalability Considerations

### Horizontal Scaling
- **Stateless services** can be replicated
- **Load balancing** through Docker Swarm or Kubernetes
- **Database connection pooling** for PostgreSQL

### Resource Management
- **Memory limits** for each service
- **CPU allocation** based on workload
- **Storage optimization** for large datasets

### Performance Optimization
- **Redis caching** for frequently accessed data
- **Connection pooling** for database operations
- **Async processing** for heavy operations

## Security Architecture

### Network Isolation
- **Internal Docker network** for service communication
- **Host network access** only for essential services
- **Port exposure** limited to necessary services

### Data Security
- **Volume encryption** for sensitive data
- **Environment variable** management for secrets
- **Access control** through authentication middleware

## Monitoring and Logging

### Log Management
```yaml
volumes:
  - ../logs:/app/logs    # Centralized logging
```

### Service Monitoring
- **Health check endpoints** for each service
- **Resource usage** monitoring
- **Performance metrics** collection

This Docker architecture provides a robust, scalable foundation for the PinnacleAi application while maintaining clear service boundaries and efficient resource utilization.
