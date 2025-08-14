# Vision RAG Implementation Guide

This guide provides practical steps for developers to implement, configure, and extend the Vision RAG system.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Configuration](#3-configuration)
4. [API Integration](#4-api-integration)
5. [Frontend Integration](#5-frontend-integration)
6. [Testing](#6-testing)
7. [Extending the System](#7-extending-the-system)
8. [Monitoring and Maintenance](#8-monitoring-and-maintenance)

## 1. Prerequisites

Before implementing Vision RAG, ensure you have the following prerequisites:

### 1.1 System Requirements

- Docker and Docker Compose
- Node.js 18+ and npm
- Python 3.9+
- PostgreSQL database
- Ollama for embeddings
- At least 8GB RAM for development, 16GB+ for production

### 1.2 External Dependencies

- Tesseract OCR for image text extraction
- ChromaDB for vector storage
- Redis for queuing and caching

## 2. Installation

### 2.1 Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2.2 Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
cd python
pip install -r requirements.txt
```

### 2.3 Build Docker Images

```bash
cd Docker
docker compose build
```

### 2.4 Start Services

```bash
docker compose up -d
```

## 3. Configuration

### 3.1 Basic Configuration

Edit the `Docker/config.docker.ini` file to configure the system:

```ini
[image_processing]
enabled = true
docker_container = productdemo-image-processor
min_size_kb = 5
min_width = 100
min_height = 100
max_images_per_document = 100
ocr_enabled = true
base64_encoding = true
max_images_in_response = 3
similarity_threshold = 0.7
keyword_boost_factor = 1.2
```

### 3.2 Advanced Configuration

#### Embedding Service

Adjust embedding service settings for your environment:

```ini
[embedding_service]
enabled = true
protocol = http
host = embedding-service
port = 3579
connection_timeout = 120000
request_timeout = 180000
ollama_host = <your-ollama-host>
ollama_port = 11434
cache_enabled = true
cache_ttl_seconds = 3600
batch_size = 50
max_batch_size = 1000
```

#### Worker Configuration

Tune worker settings based on your hardware capabilities:

```ini
[document_queue]
worker_count = 3          # Increase for more parallel processing
concurrency = 3           # Number of concurrent tasks per worker
max_jobs_per_worker = 10  # Maximum jobs per worker
retry_attempts = 3        # Number of retry attempts
job_timeout = 600000      # Timeout in milliseconds (10 minutes)
```

### 3.3 Environment Variables

Create a `.env` file in the Docker directory:

```
# Host machine IP (for accessing PostgreSQL and Ollama)
HOST_MACHINE_IP=172.16.16.23

# Service ports
APP_PORT=5641
CHROMADB_HOST_PORT=8001
CHROMADB_CONTAINER_PORT=8000
REDIS_HOST_PORT=6379
REDIS_CONTAINER_PORT=6379
EMBEDDING_HOST_PORT=3579
EMBEDDING_CONTAINER_PORT=3579
TEXT_PROCESSOR_PORT=3580
MCP_ORCHESTRATOR_PORT=3581
DIR_CREATE_PORT=3582
IMAGE_PROCESSOR_PORT=8430

# Database configuration
DATABASE_HOST=172.16.16.23
DATABASE_PORT=5432
DATABASE_NAME=copilot
DATABASE_USER=postgres
DATABASE_PASSWORD=root
```

## 4. API Integration

### 4.1 Document Upload Endpoint

```javascript
// Example API call to upload a document
async function uploadDocument(file, userId, sessionId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);
  formData.append('sessionId', sessionId);
  
  const response = await fetch('/api/documents/upload', {
    method: 'POST',
    body: formData
  });
  
  return response.json();
}
```

### 4.2 RAG Query Endpoint

```javascript
// Example API call to query the RAG system
async function queryRag(query, userId, sessionId, includeImages = true) {
  const response = await fetch('/api/rag/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      userId,
      sessionId,
      includeImages
    })
  });
  
  return response.json();
}
```

### 4.3 Processing Status Endpoint

```javascript
// Example API call to check document processing status
async function checkProcessingStatus(documentId) {
  const response = await fetch(`/api/documents/${documentId}/status`);
  return response.json();
}
```

## 5. Frontend Integration

### 5.1 React Component for RAG Chat

```tsx
import React, { useState } from 'react';
import { RagChatResponse, RagImage } from '../types';

interface ChatProps {
  userId: string;
  sessionId: string;
}

export const RagChat: React.FC<ChatProps> = ({ userId, sessionId }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<RagChatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const result = await queryRag(query, userId, sessionId);
      setResponse(result);
    } catch (error) {
      console.error('Error querying RAG:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="rag-chat">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question..."
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Ask'}
        </button>
      </form>
      
      {response && (
        <div className="response">
          <div className="text-content">{response.content}</div>
          
          {/* Display images if available */}
          {response.images && response.images.length > 0 && (
            <div className="image-gallery">
              <h4>Relevant Images:</h4>
              <div className="images">
                {response.images.map((image, index) => (
                  <div key={index} className="image-item">
                    <img
                      src={`data:image/png;base64,${image.base64}`}
                      alt={`Page ${image.page} - ${image.keywords}`}
                      title={`${image.filename} (Score: ${image.score.toFixed(2)})`}
                    />
                    <div className="image-info">
                      <span>Page {image.page}</span>
                      <span>Score: {image.score.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Display sources */}
          {response.sources && response.sources.length > 0 && (
            <div className="sources">
              <h4>Sources:</h4>
              <ul>
                {response.sources.map((source, index) => (
                  <li key={index}>
                    {source.metadata.fileName} (p.{source.metadata.page})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### 5.2 Document Upload Component

```tsx
import React, { useState } from 'react';

interface UploadProps {
  userId: string;
  sessionId: string;
  onUploadComplete: (documentId: string) => void;
}

export const DocumentUpload: React.FC<UploadProps> = ({ 
  userId, 
  sessionId,
  onUploadComplete
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    
    setUploading(true);
    setProgress(0);
    
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);
      formData.append('sessionId', sessionId);
      
      // Upload with progress tracking
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/documents/upload');
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setProgress(percentComplete);
        }
      });
      
      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          onUploadComplete(response.documentId);
          setUploading(false);
        } else {
          console.error('Upload failed');
          setUploading(false);
        }
      };
      
      xhr.onerror = () => {
        console.error('Upload error');
        setUploading(false);
      };
      
      xhr.send(formData);
    } catch (error) {
      console.error('Error uploading document:', error);
      setUploading(false);
    }
  };
  
  return (
    <div className="document-upload">
      <form onSubmit={handleSubmit}>
        <input 
          type="file" 
          onChange={handleFileChange}
          accept=".pdf,.docx,.doc,.txt,.md"
          disabled={uploading}
        />
        <button type="submit" disabled={!file || uploading}>
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
        
        {uploading && (
          <div className="progress-bar">
            <div 
              className="progress" 
              style={{ width: `${progress}%` }}
            ></div>
            <span>{progress}%</span>
          </div>
        )}
      </form>
    </div>
  );
};
```

## 6. Testing

### 6.1 Testing Document Processing

```bash
# Test image extraction from a PDF
curl -X POST http://localhost:5641/api/test/extract-images \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/path/to/test.pdf", "userId": "test-user"}'

# Test OCR on an image
curl -X POST http://localhost:8430/ocr \
  -F "image=@/path/to/test-image.png"
```

### 6.2 Testing RAG Queries

```bash
# Test a RAG query with images
curl -X POST http://localhost:5641/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me the DDR4 PHY architecture",
    "userId": "test-user",
    "sessionId": "test-session",
    "includeImages": true
  }'
```

### 6.3 Automated Testing

Create a test script to validate the entire pipeline:

```javascript
// test/vision-rag.test.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function testVisionRag() {
  const userId = 'test-user-' + Date.now();
  const sessionId = 'test-session-' + Date.now();
  const testPdf = path.join(__dirname, 'fixtures', 'test-document.pdf');
  
  console.log('1. Uploading test document...');
  
  // Upload document
  const formData = new FormData();
  formData.append('file', fs.createReadStream(testPdf));
  formData.append('userId', userId);
  formData.append('sessionId', sessionId);
  
  const uploadResponse = await axios.post('http://localhost:5641/api/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  const documentId = uploadResponse.data.documentId;
  console.log(`Document uploaded with ID: ${documentId}`);
  
  // Wait for processing to complete
  console.log('2. Waiting for processing to complete...');
  let status = 'processing';
  while (status === 'processing') {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const statusResponse = await axios.get(`http://localhost:5641/api/documents/${documentId}/status`);
    status = statusResponse.data.status;
    console.log(`Processing status: ${status} (${statusResponse.data.progress || 0}%)`);
  }
  
  if (status !== 'completed') {
    throw new Error(`Processing failed with status: ${status}`);
  }
  
  // Test RAG query
  console.log('3. Testing RAG query...');
  const queryResponse = await axios.post('http://localhost:5641/api/rag/query', {
    query: 'What is the main topic of this document?',
    userId,
    sessionId,
    includeImages: true
  });
  
  console.log('Query response:');
  console.log('- Text:', queryResponse.data.response);
  console.log('- Sources:', queryResponse.data.sources.length);
  console.log('- Images:', queryResponse.data.images?.length || 0);
  
  return {
    success: true,
    documentId,
    queryResponse: queryResponse.data
  };
}

testVisionRag().then(console.log).catch(console.error);
```

## 7. Extending the System

### 7.1 Adding Custom Image Processors

Create a new image processor plugin:

```javascript
// src/plugins/imageProcessors/diagramDetector.js
class DiagramDetector {
  constructor(options = {}) {
    this.threshold = options.threshold || 0.7;
    this.modelPath = options.modelPath || './models/diagram-detector.onnx';
    // Initialize your model here
  }
  
  async detect(imageBuffer) {
    // Implement diagram detection logic
    // Return confidence score and detected diagram type
    return {
      isDiagram: true,
      confidence: 0.92,
      type: 'circuit_diagram',
      regions: [
        { x: 100, y: 150, width: 300, height: 200, label: 'component_1' },
        { x: 450, y: 200, width: 100, height: 100, label: 'component_2' }
      ]
    };
  }
}

module.exports = DiagramDetector;
```

Register the plugin in the image processor service:

```javascript
// src/services/imageProcessorService.js
const DiagramDetector = require('../plugins/imageProcessors/diagramDetector');

class ImageProcessorService {
  constructor() {
    this.processors = [];
    this.registerDefaultProcessors();
  }
  
  registerDefaultProcessors() {
    // Register built-in processors
    this.processors.push(new OcrProcessor());
    
    // Register custom processors
    this.processors.push(new DiagramDetector({
      threshold: 0.65
    }));
  }
  
  // Rest of the service implementation
}
```

### 7.2 Creating Custom Embedding Models

Implement a custom embedding provider:

```javascript
// src/services/embedding/customEmbeddingProvider.js
class CustomEmbeddingProvider {
  constructor(options = {}) {
    this.modelName = options.modelName || 'custom-embedding-model';
    this.dimension = options.dimension || 384;
    this.batchSize = options.batchSize || 32;
    // Initialize your model here
  }
  
  async generateEmbeddings(texts) {
    // Implement your embedding logic
    // Return array of embeddings
    return texts.map(text => {
      // Generate embedding for text
      return new Array(this.dimension).fill(0).map(() => Math.random());
    });
  }
}

module.exports = CustomEmbeddingProvider;
```

Register the custom provider:

```javascript
// src/services/embeddingService.js
const CustomEmbeddingProvider = require('./embedding/customEmbeddingProvider');

class EmbeddingService {
  constructor(config) {
    this.providers = {};
    this.registerProviders(config);
  }
  
  registerProviders(config) {
    // Register default Ollama provider
    this.providers.ollama = new OllamaEmbeddingProvider({
      host: config.ollama_host,
      port: config.ollama_port,
      model: 'nomic-embed-text'
    });
    
    // Register custom provider
    this.providers.custom = new CustomEmbeddingProvider({
      dimension: 384,
      batchSize: 64
    });
    
    // Set default provider
    this.defaultProvider = this.providers.ollama;
  }
  
  // Rest of the service implementation
}
```

### 7.3 Implementing Custom Chunking Strategies

Create a custom chunking strategy:

```javascript
// src/services/chunking/technicalDocumentChunker.js
class TechnicalDocumentChunker {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 1000;
    this.chunkOverlap = options.chunkOverlap || 200;
    this.sectionPatterns = [
      /^#{1,6}\s+.+$/m,                  // Markdown headers
      /^[A-Z0-9\s]{2,}:$/m,              // Section titles
      /^(?:\d+\.){1,3}\s+.+$/m,          // Numbered sections
      /^(?:Figure|Table)\s+\d+:/m,       // Figures and tables
      /^References$/m                     // References section
    ];
  }
  
  chunk(text) {
    // Implement technical document chunking logic
    // that respects section boundaries
    
    // Split by sections first
    const sections = this.splitBySections(text);
    
    // Then chunk each section
    const chunks = [];
    for (const section of sections) {
      if (section.length <= this.chunkSize) {
        chunks.push(section);
      } else {
        // Further chunk the section
        const sectionChunks = this.chunkSection(section);
        chunks.push(...sectionChunks);
      }
    }
    
    return chunks;
  }
  
  splitBySections(text) {
    // Implementation details
  }
  
  chunkSection(section) {
    // Implementation details
  }
}

module.exports = TechnicalDocumentChunker;
```

## 8. Monitoring and Maintenance

### 8.1 Health Checks

Implement health check endpoints for each service:

```javascript
// Example health check endpoint
app.get('/health', (req, res) => {
  const status = {
    service: 'image-processor',
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    checks: {
      tesseract: checkTesseractStatus(),
      storage: checkStorageStatus(),
      memory: checkMemoryUsage()
    }
  };
  
  const isHealthy = Object.values(status.checks)
    .every(check => check.status === 'ok');
  
  res.status(isHealthy ? 200 : 503).json(status);
});
```

### 8.2 Monitoring Dashboard

Set up a monitoring dashboard using Prometheus and Grafana:

1. Add Prometheus metrics to your services:

```javascript
const prometheus = require('prom-client');

// Create a Registry to register the metrics
const register = new prometheus.Registry();

// Create metrics
const httpRequestDurationMicroseconds = new prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000, 10000]
});

// Register the metrics
register.registerMetric(httpRequestDurationMicroseconds);

// Add metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Use middleware to measure request duration
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ 
      method: req.method, 
      route: req.route?.path || req.path, 
      status: res.statusCode 
    });
  });
  next();
});
```

2. Configure Prometheus to scrape these endpoints
3. Set up Grafana dashboards to visualize the metrics

### 8.3 Log Management

Implement structured logging:

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'image-processor' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// Example usage
logger.info('Processing image', { 
  imageId: 'img123', 
  size: '1.2MB', 
  dimensions: '1200x800' 
});

logger.error('OCR processing failed', {
  imageId: 'img123',
  error: err.message,
  stack: err.stack
});
```

### 8.4 Backup and Recovery

Set up regular backups of critical data:

```bash
#!/bin/bash
# backup-script.sh

# Backup ChromaDB data
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/chromadb/$TIMESTAMP"

mkdir -p $BACKUP_DIR

# Stop ChromaDB container
docker stop productdemo-chromadb

# Copy data
cp -r ./DATA/chroma_data/* $BACKUP_DIR/

# Restart ChromaDB container
docker start productdemo-chromadb

# Backup PostgreSQL database
pg_dump -h 172.16.16.23 -U postgres -d copilot > "/backups/postgres/copilot_$TIMESTAMP.sql"

# Compress backups
tar -czf "/backups/archive/vision_rag_backup_$TIMESTAMP.tar.gz" $BACKUP_DIR "/backups/postgres/copilot_$TIMESTAMP.sql"

# Clean up old backups (keep last 7 days)
find /backups/archive -name "vision_rag_backup_*.tar.gz" -type f -mtime +7 -delete
```

Schedule this script to run daily using cron:

```
0 2 * * * /path/to/backup-script.sh >> /var/log/backup.log 2>&1
``` 