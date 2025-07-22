# PinnacleAi Application Architecture

## Overview

PinnacleAi is a comprehensive AI-powered application that combines document processing, chat functionality, prediction capabilities, and database management in a containerized microservices architecture.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        HOST MACHINE                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   PostgreSQL    │  │     Ollama      │  │   File System   │ │
│  │   Database      │  │   AI Service    │  │     Storage     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │   Docker Network      │
                    │  productdemo-network  │
                    └───────────┬───────────┘
                                │
┌───────────────────────────────┴───────────────────────────────────┐
│                    DOCKER CONTAINERS                               │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │     App     │  │  ChromaDB   │  │    Redis    │  │ Embedding   ││
│  │ (Main Node) │  │  (Vector)   │  │   (Cache)   │  │  Service    ││
│  │   :5641     │  │   :8001     │  │   :6379     │  │   :3579     ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │Doc Workers  │  │Text Proc.   │  │MCP Orch.    │  │Image Proc.  ││
│  │(Background) │  │   :3580     │  │   :3581     │  │   :8430     ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐                                  │
│  │  Chat2SQL   │  │  RunStatus  │                                  │
│  │   :5000     │  │   :5003     │                                  │
│  └─────────────┘  └─────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Main Application (Node.js)
**Container**: `productdemo-app`  
**Port**: 5641  
**Purpose**: Primary application server

**Key Features**:
- Express.js web server
- React frontend serving
- API route management
- WebSocket server
- Session management
- Authentication & authorization

**Route Structure**:
```
/api/auth          - Authentication routes
/api/users         - User management
/api/chatbot       - Chat functionality
/api/runs          - Run status management
/api/settings      - Application settings
/api/dashboard     - Dashboard data
/api/ollama        - Ollama AI integration
/api/mcp           - MCP (Model Context Protocol)
/api/documents     - Document management
/api/ai            - AI processing
/api/flowtrack     - Flow tracking
/api/prediction-db - Prediction database
```

### 2. Database Layer

#### PostgreSQL (Host Machine)
- **Primary database** for application data
- **User management** and authentication
- **Document metadata** and processing status
- **Settings and configurations**
- **Prediction database settings**

#### ChromaDB (Container)
- **Vector database** for document embeddings
- **Semantic search** capabilities
- **Document similarity** matching

#### Redis (Container)
- **Session storage**
- **Background job queues**
- **Caching layer**

### 3. Processing Services

#### Document Workers
- **Background processing** of uploaded documents
- **Text extraction** and analysis
- **Embedding generation**
- **Database updates**

#### Text Processor (:3580)
- **Text extraction** from various document formats
- **Content preprocessing**
- **Format normalization**

#### Image Processor (:8430)
- **Image analysis** and processing
- **OCR capabilities**
- **Visual content extraction**

#### Embedding Service (:3579)
- **Text embedding generation**
- **Vector representation** of documents
- **Integration with Ollama**

### 4. AI & Analysis Services

#### MCP Orchestrator (:3581)
- **Model Context Protocol** management
- **AI model coordination**
- **Context handling**

#### Chat2SQL (:5000)
- **Natural language to SQL** conversion
- **Database query generation**
- **Query optimization**

#### RunStatus (:5003)
- **Analysis run tracking**
- **Status monitoring**
- **Progress reporting**

## Data Flow

### 1. Document Processing Flow
```
User Upload → App → Text Processor → Embedding Service → ChromaDB
                 ↓
            Document Workers → PostgreSQL (metadata)
```

### 2. Chat Interaction Flow
```
User Message → App → Ollama (Host) → AI Response
                  ↓
            Context Retrieval ← ChromaDB
```

### 3. Prediction Workflow
```
User Config → Settings API → Prediction DB (PostgreSQL)
                          ↓
            Prediction Module → External PostgreSQL → Results
```

## Configuration Management

### Config Files
- **`conf/config.ini`** - Main application configuration
- **`Docker/config.docker.ini`** - Docker-specific settings
- **`Docker/env.docker`** - Environment variables

### Settings Architecture
- **Basic Settings**: Theme, API keys (SQLite-compatible)
- **Prediction Settings**: Database connections (PostgreSQL-specific)
- **User Preferences**: Per-user configurations

## Security Model

### Authentication
- **Session-based** authentication
- **Role-based** access control (admin/user)
- **Secure password** hashing (bcrypt)

### Network Security
- **Internal Docker network** for service communication
- **Host network access** only for PostgreSQL and Ollama
- **CORS configuration** for frontend integration

## Deployment Architecture

### Docker Compose Services
1. **Infrastructure**: ChromaDB, Redis
2. **Processing**: Embedding, Text, Image, MCP services
3. **Application**: Main app, Workers
4. **Analysis**: Chat2SQL, RunStatus

### Volume Mounts
- **Data persistence**: `./DATA` for file storage
- **Configuration**: `./conf` for settings
- **Logs**: `./logs` for application logs

### Environment Variables
- **Database connections** to host services
- **Service URLs** for inter-container communication
- **Port configurations** for external access

## Scalability Considerations

### Horizontal Scaling
- **Stateless services** can be replicated
- **Redis session storage** enables load balancing
- **Background workers** can be scaled independently

### Performance Optimization
- **Vector database** for fast similarity search
- **Redis caching** for frequently accessed data
- **Background processing** for heavy operations

This architecture provides a robust, scalable foundation for AI-powered document processing and analysis while maintaining clear separation of concerns and service boundaries.
