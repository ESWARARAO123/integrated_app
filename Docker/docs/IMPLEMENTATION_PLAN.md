# Python Containerization Implementation Plan

## Overview

This document outlines the implementation plan for containerizing Python processing components in the ProductDemo RAG system. The plan addresses the single-threaded execution bottleneck by moving Python processing into dedicated microservices that can be scaled horizontally.

## Services to Implement

1. **Text Processing Service**
   - Containerizes PDF text extraction functionality
   - Provides REST API endpoints for text extraction
   - Supports both basic text and table extraction

2. **MCP Orchestrator Service**
   - Containerizes terminal-mcp-orchestrator functionality
   - Provides REST API endpoints for MCP command execution
   - Maintains connection pooling to MCP server

## Implementation Timeline

### Phase 1: Development and Testing (Week 1)

#### Text Processing Service

| Day | Task | Description |
|-----|------|-------------|
| 1 | Create Dockerfile | Build `Dockerfile.text-processor` with Python and Node.js |
| 1 | Create API server | Implement Express.js API server with endpoints |
| 2 | Test extraction | Test text extraction with various PDF documents |
| 2 | Add health checks | Implement health checks and monitoring |
| 3 | Add to docker-compose | Update docker-compose.yml with text-processor service |

#### MCP Orchestrator Service

| Day | Task | Description |
|-----|------|-------------|
| 3 | Create Dockerfile | Build `Dockerfile.mcp-orchestrator` with Python and Node.js |
| 3 | Create API server | Implement Express.js API server with endpoints |
| 4 | Test command execution | Test MCP command execution with various tools |
| 4 | Add health checks | Implement health checks and monitoring |
| 5 | Add to docker-compose | Update docker-compose.yml with mcp-orchestrator service |

### Phase 2: Integration (Week 2)

#### Text Processing Integration

| Day | Task | Description |
|-----|------|-------------|
| 1 | Update documentProcessor.js | Add methods to call text processing service |
| 1 | Add fallback mechanism | Implement fallback to local Python if service fails |
| 2 | Add configuration | Add text_processor section to config.ini |
| 2 | Test integration | Test integration with existing document processing |

#### MCP Orchestrator Integration

| Day | Task | Description |
|-----|------|-------------|
| 3 | Update shellCommandService.js | Add methods to call MCP orchestrator service |
| 3 | Add fallback mechanism | Implement fallback to local Python if service fails |
| 4 | Add configuration | Add mcp_orchestrator section to config.ini |
| 4 | Test integration | Test integration with existing command execution |

### Phase 3: Scaling and Optimization (Week 3)

#### Performance Testing

| Day | Task | Description |
|-----|------|-------------|
| 1 | Benchmark services | Test performance with various document sizes |
| 1 | Identify bottlenecks | Analyze performance metrics and identify bottlenecks |
| 2 | Optimize containers | Adjust container resources and configurations |
| 2 | Test concurrency | Test with multiple concurrent requests |

#### Scaling Implementation

| Day | Task | Description |
|-----|------|-------------|
| 3 | Configure scaling | Set up container scaling in docker-compose.yml |
| 3 | Add load balancing | Configure Nginx for load balancing |
| 4 | Test scaled services | Test performance with scaled services |
| 4 | Document scaling | Update documentation with scaling information |
| 5 | Final review | Review implementation and address any issues |

## Technical Details

### Text Processing Service

#### API Endpoints

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/health` | GET | Health check | None |
| `/extract-text` | POST | Extract text from PDF | `document` (file), `userId`, `sessionId`, `documentId` |
| `/extract-tables` | POST | Extract text with tables | `document` (file), `userId`, `sessionId`, `documentId` |

#### Configuration

```ini
[text_processor]
use_service = true
url = http://localhost:3580
extract_tables = true
fallback_enabled = true
fallback_timeout = 30000
```

### MCP Orchestrator Service

#### API Endpoints

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/health` | GET | Health check | None |
| `/tools` | GET | List available tools | `server` (query parameter) |
| `/execute` | POST | Execute MCP command | `server`, `tool`, `parameters` (JSON body) |

#### Configuration

```ini
[mcp_orchestrator]
use_service = true
url = http://localhost:3581
server_url = http://localhost:8080
fallback_enabled = true
fallback_timeout = 30000
```

## Testing Strategy

### Unit Testing

1. Test each API endpoint with valid and invalid inputs
2. Test error handling and fallback mechanisms
3. Test with various document types and sizes
4. Test with various MCP commands and parameters

### Integration Testing

1. Test integration with existing document processing
2. Test integration with existing command execution
3. Test fallback mechanisms when services are unavailable
4. Test with real-world documents and commands

### Load Testing

1. Test with multiple concurrent requests
2. Test with large documents
3. Test with long-running commands
4. Test scaling under load

## Deployment Strategy

### Development Environment

1. Build and deploy services locally
2. Test with development configuration
3. Verify functionality with test documents and commands

### Staging Environment

1. Deploy to staging environment
2. Test with production-like configuration
3. Verify functionality with real-world documents and commands
4. Test scaling and performance

### Production Environment

1. Deploy to production environment
2. Monitor performance and resource usage
3. Adjust scaling as needed
4. Implement automated scaling based on load

## Rollback Plan

If issues arise during deployment:

1. Set `use_service = false` in configuration
2. Restart the application
3. The system will revert to using local Python execution
4. Fix issues with the containerized services
5. Re-enable with `use_service = true`

## Success Criteria

The implementation will be considered successful when:

1. Text processing and MCP orchestration are fully containerized
2. Services can be scaled horizontally to handle increased load
3. Performance is equal to or better than local Python execution
4. Fallback mechanisms ensure reliability during transition
5. All tests pass in development, staging, and production environments 