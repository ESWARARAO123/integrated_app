# Python Processing Containerization Tracker

## Current Architecture Analysis

### 1. Python Processing Components

| Component | Current Implementation | Scalability Issue | Containerization Status |
|-----------|------------------------|-------------------|-------------------------|
| Text Extraction | Local Python process via `spawn()` | Single-threaded, host-dependent | ❌ Not containerized |
| Table Extraction | Local Python process via `spawn()` | Single-threaded, host-dependent | ❌ Not containerized |
| Image Processing | Docker container via `docker compose exec` | Container exists but called via exec | ✅ Containerized |
| MCP Orchestrator | Python script calling remote MCP server | Remote execution model | ⚠️ Partial |
| Embedding Service | Node.js service with Docker container | Already containerized | ✅ Containerized |
| Chat2SQL | Python service with Docker container | Already containerized | ✅ Containerized |

### 2. Critical Python Scripts to Containerize

| Script Path | Purpose | Dependencies | Current Invocation |
|-------------|---------|--------------|-------------------|
| `python/RAG-MODULE/extract_text.py` | Basic text extraction from PDFs | pdfplumber | Local Python spawn |
| `python/RAG-MODULE/extract_text_with_tables.py` | Enhanced text extraction with table detection | pdfplumber, re | Local Python spawn |
| `python/terminal-mcp-orchestrator/orchestrator.py` | Routes commands to MCP server | mcp_client | Local Python spawn |

### 3. Python Dependencies

```
# Core dependencies from requirements.txt
requests>=2.28.0
sseclient-py>=1.7.2
pytest>=7.0.0 
pdfplumber==0.9.0
Pillow>=9.0.0
Wand>=0.6.7
cryptography>=38.0.0 
fastapi==0.110.0
uvicorn==0.29.0
pydantic==2.7.1
pandas==2.2.2
psycopg2-binary==2.9.9
python-dotenv==1.0.1
```

## Containerization Strategy

### 1. Text Processing Service

Create a dedicated microservice for text extraction that:
- Runs in its own container
- Exposes REST API endpoints for text extraction
- Handles both basic text and table extraction
- Can scale horizontally

### 2. MCP Orchestrator Service

Create a containerized version of the MCP orchestrator that:
- Runs in its own container
- Exposes REST API endpoints for command execution
- Maintains connection pooling to MCP server
- Handles concurrent requests efficiently

### 3. Integration Points

| Service | Integration Method | API Endpoint | Request Format |
|---------|-------------------|--------------|----------------|
| Text Processor | REST API | `/extract-text` | `POST` with PDF file |
| Table Processor | REST API | `/extract-tables` | `POST` with PDF file |
| MCP Orchestrator | REST API | `/execute-command` | `POST` with command details |

## Implementation Checklist

### Text Processing Service

- [ ] Create `Dockerfile.text-processor`
- [ ] Create REST API wrapper for Python extraction scripts
- [ ] Implement health checks and monitoring
- [ ] Add to docker-compose.yml
- [ ] Update Node.js code to call API instead of local Python

### MCP Orchestrator Service

- [ ] Create `Dockerfile.mcp-orchestrator`
- [ ] Create REST API wrapper for MCP orchestrator
- [ ] Implement connection pooling and request queuing
- [ ] Add to docker-compose.yml
- [ ] Update Node.js code to call API instead of local Python

### Shared Infrastructure

- [ ] Create shared Python base image with common dependencies
- [ ] Set up Redis for inter-service communication
- [ ] Configure load balancing for horizontal scaling
- [ ] Implement centralized logging

## Migration Path

1. Create containerized services without changing existing code
2. Add API endpoints to new containers
3. Create feature flags to toggle between local and containerized execution
4. Gradually migrate code to use containerized services
5. Remove local Python execution code once migration is complete

## Performance Monitoring

| Metric | Current (Local) | Target (Containerized) |
|--------|----------------|------------------------|
| Text extraction time | ~15-30s | ~5-15s |
| Concurrent extractions | 1 | 10+ |
| Memory usage | Variable (host) | Constrained (container) |
| CPU usage | Unconstrained | Limited by container |
| Failure isolation | None | Per-container |

## Fallback Mechanism

Implement a fallback strategy that:
1. Attempts to use containerized service first
2. Falls back to local Python execution if containerized service fails
3. Logs failures and performance metrics for both approaches
4. Gradually phases out fallback as containerized service proves reliable 