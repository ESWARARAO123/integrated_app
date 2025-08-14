# Vision RAG: Multimodal Retrieval-Augmented Generation Architecture

## 1. Introduction

The Vision RAG system is an advanced multimodal retrieval-augmented generation architecture that enhances traditional text-based RAG with visual content processing. This system enables users to query both textual and visual information from documents, providing comprehensive responses that include relevant images alongside text.

### 1.1 Key Features

- **Multimodal Processing**: Extract and index both text and images from documents
- **OCR Integration**: Convert text within images to searchable content
- **Intelligent Image Retrieval**: Return relevant images based on semantic search
- **Visual Context Enhancement**: Augment text responses with visual information
- **User Isolation**: Maintain separate data collections for each user

## 2. System Architecture

The Vision RAG system consists of several containerized microservices that work together to process, store, and retrieve multimodal content.

### 2.1 Core Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Text Processor │     │ Image Processor │     │ Embedding       │
│  Service        │     │ Service         │     │ Service         │
│  (3580)         │     │ (8430)          │     │ (3579)          │
│                 │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Document       │     │  ChromaDB       │     │  Redis          │
│  Workers        │     │  Vector DB      │     │  Queue & Cache  │
│                 │     │  (8000)         │     │  (6379)         │
│                 │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │  Main App       │
                        │  (5641)         │
                        │                 │
                        └─────────────────┘
```

### 2.2 Service Descriptions

1. **Text Processor Service (Port 3580)**
   - Extracts text from various document formats (PDF, DOCX, TXT, etc.)
   - Handles document chunking with semantic boundaries
   - Processes tables and structured content

2. **Image Processor Service (Port 8430)**
   - Extracts images from documents
   - Performs OCR on image content using Tesseract
   - Filters meaningful images based on size and content
   - Encodes images as Base64 for storage

3. **Embedding Service (Port 3579)**
   - Generates vector embeddings for text and image keywords
   - Uses Ollama's embedding models
   - Handles batch processing and caching
   - Optimizes for performance

4. **Document Workers**
   - Orchestrates the document processing pipeline
   - Manages queues for processing tasks
   - Handles retries and error recovery
   - Coordinates between services

5. **ChromaDB Vector Database (Port 8000)**
   - Stores vector embeddings for text and images
   - Enables semantic search across multimodal content
   - Maintains user-isolated collections
   - Supports hybrid search capabilities

6. **Redis (Port 6379)**
   - Manages processing queues
   - Caches embeddings for performance
   - Handles session data
   - Enables distributed processing

7. **Main Application (Port 5641)**
   - Provides user interface and API endpoints
   - Handles authentication and user management
   - Orchestrates RAG queries and responses
   - Renders multimodal content

## 3. Document Processing Workflow

### 3.1 Upload and Processing Pipeline

```
Document Upload → Text Extraction → Chunking → Vector Embedding → Storage
                     ↓                                  ↑
                Image Extraction → OCR → Keyword Extraction
```

1. **Document Upload**
   - User uploads a document (PDF, DOCX, etc.)
   - System validates format and size
   - Document is stored in user-specific storage

2. **Text Extraction**
   - Text processor extracts plain text
   - Preserves document structure
   - Handles formatting and special characters

3. **Image Extraction**
   - Image processor identifies and extracts embedded images
   - Filters images based on size and quality (min 5KB, 100x100px)
   - Performs OCR on image content

4. **Chunking**
   - Text is divided into semantic chunks
   - Maintains context and meaning
   - Respects document structure (paragraphs, sections)

5. **Vector Embedding**
   - Text chunks are embedded using Ollama
   - Image OCR text is embedded
   - Metadata is attached to each embedding

6. **Storage**
   - Vectors stored in ChromaDB
   - Original content cached for retrieval
   - User isolation maintained throughout

### 3.2 Image Processing Details

```
Image Extraction → Size/Quality Filtering → OCR Processing → Keyword Extraction → Base64 Encoding → Storage
```

- **Extraction**: Images are extracted from PDFs and other documents
- **Filtering**: Small or decorative images are filtered out
- **OCR**: Tesseract OCR extracts text from images
- **Keyword Extraction**: Key terms are identified for search
- **Encoding**: Images are Base64 encoded for storage
- **Storage**: Images stored with metadata and keywords

## 4. Query Processing Workflow

### 4.1 RAG Query Pipeline

```
User Query → Query Embedding → Vector Search → Context Retrieval → Response Generation
                                    ↓
                              Image Retrieval → Relevance Ranking → Response Enhancement
```

1. **Query Processing**
   - User submits a natural language query
   - Query is embedded using the same model as documents
   - System determines if query might benefit from visual content

2. **Vector Search**
   - Embedded query searches ChromaDB for relevant text chunks
   - Parallel search for relevant images based on query
   - Results are scored by relevance

3. **Context Assembly**
   - Most relevant text chunks are assembled
   - Top-ranked images are selected (up to configured limit)
   - Context is optimized for the response model

4. **Response Generation**
   - LLM generates response using text context
   - Response is enhanced with image references
   - Citations and sources are included

5. **Result Presentation**
   - Text response displayed to user
   - Relevant images shown alongside text
   - Source citations provided for transparency

### 4.2 Image Retrieval Logic

```
Query → Keyword Extraction → Image Keyword Matching → Similarity Scoring → Top-K Selection
```

- **Keyword Analysis**: Extract key terms from user query
- **Semantic Matching**: Match query embedding against image keywords
- **Hybrid Ranking**: Combine keyword and semantic similarity scores
- **Filtering**: Apply threshold to ensure relevance
- **Selection**: Return top-K most relevant images

## 5. Configuration and Settings

### 5.1 Image Processing Configuration

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

### 5.2 Document Processing Configuration

```ini
[document_queue]
worker_count = 3
concurrency = 3
max_jobs_per_worker = 10
retry_attempts = 3
remove_completed_after = 50
remove_failed_after = 20
stalled_interval = 30000
max_stalled_count = 1
job_timeout = 600000
```

### 5.3 Embedding Service Configuration

```ini
[embedding_service]
enabled = true
protocol = http
host = embedding-service
port = 3579
connection_timeout = 120000
request_timeout = 180000
ollama_host = 172.16.16.21
ollama_port = 11434
cache_enabled = true
cache_ttl_seconds = 3600
rate_limit_requests = 1000
rate_limit_window_minutes = 15
batch_size = 50
max_batch_size = 1000
```

## 6. API and Integration

### 6.1 RAG Response Format

```json
{
  "success": true,
  "response": "The DDR4 PHY architecture consists of...",
  "sources": [
    {
      "text": "Hard IP LPDDR4/3+DDR4/3 PHY with DFI Wrapper...",
      "metadata": { "page": 14, "fileName": "technical_spec.pdf" },
      "score": 0.89
    }
  ],
  "images": [
    {
      "imageId": "img_p14_i2_90cca6d5",
      "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
      "keywords": "Hard IP LPDDR4/3+DDR4/3 PHY with DFI Wrapper DDR PHY",
      "page": 14,
      "filename": "img_p14_i2_90cca6d5.png",
      "dimensions": "1217x576",
      "score": 0.85,
      "fileName": "technical_spec.pdf"
    }
  ]
}
```

### 6.2 TypeScript Interfaces

```typescript
export interface RagChatResponse {
  content: string;
  sources: RagSource[];
  images?: RagImage[];
  ragAvailable: boolean;
}

export interface RagImage {
  imageId: string;
  base64: string;
  keywords: string;
  page: number;
  filename: string;
  dimensions: string;
  score: number;
  documentId: string;
  fileName: string;
}
```

## 7. Performance and Optimization

### 7.1 Performance Metrics

- **Document Processing**: ~5-10 seconds per page (text + images)
- **Image Extraction**: ~0.5-2 seconds per image
- **OCR Processing**: ~1-3 seconds per image
- **Query Response**: ~1-2 seconds for combined text+image results
- **Vector Search**: <500ms for most queries

### 7.2 Optimization Strategies

1. **Batch Processing**
   - Process multiple embeddings in a single request
   - Group similar operations for efficiency

2. **Caching**
   - Cache embeddings in Redis
   - Store processed images for reuse
   - Cache common query results

3. **Parallel Processing**
   - Extract text and images simultaneously
   - Use worker pools for distributed processing
   - Implement queue-based task distribution

4. **Resource Management**
   - Limit maximum concurrent operations
   - Implement backpressure mechanisms
   - Monitor and adjust resource allocation

## 8. User Isolation and Security

### 8.1 Data Isolation

- Each user's documents and embeddings are stored in isolated collections
- Collection naming follows pattern: `user_{userId}_docs`
- Cross-user data access is prevented by design

### 8.2 Security Measures

- Authentication required for all operations
- HTTPS for all communications
- Input validation and sanitization
- Rate limiting to prevent abuse
- Least privilege principle for services

## 9. Troubleshooting

### 9.1 Common Issues

1. **Image Processing Failures**
   - Check image processor container logs
   - Verify Tesseract OCR installation
   - Ensure sufficient memory for image processing

2. **Vector Search Issues**
   - Verify ChromaDB connection
   - Check collection existence and naming
   - Monitor embedding quality and dimensions

3. **Performance Bottlenecks**
   - Monitor Redis memory usage
   - Check worker queue backlog
   - Optimize batch sizes for embeddings

### 9.2 Diagnostic Tools

- Container logs: `docker logs productdemo-image-processor`
- Health checks: `curl http://localhost:8430/health`
- Queue monitoring: Redis CLI commands
- ChromaDB inspection: ChromaDB web interface

## 10. Future Enhancements

### 10.1 Planned Improvements

1. **Advanced Image Understanding**
   - Integration with vision models for image content analysis
   - Object detection and classification
   - Diagram and chart interpretation

2. **Enhanced Multimodal Reasoning**
   - Cross-reference information between text and images
   - Answer questions about visual content
   - Generate explanations of visual elements

3. **Interactive Visual Elements**
   - Highlight regions of images in responses
   - Interactive zooming and exploration
   - Visual annotations and explanations

4. **Performance Optimizations**
   - More efficient image storage and retrieval
   - Improved OCR accuracy and speed
   - Dynamic resource allocation

## 11. Conclusion

The Vision RAG system represents a significant advancement in multimodal information retrieval and generation. By combining text and image processing capabilities, it provides users with richer, more comprehensive responses that leverage both textual and visual information sources. The containerized microservice architecture ensures scalability, maintainability, and isolation, while the intelligent processing pipelines deliver high-quality results with optimized performance. 