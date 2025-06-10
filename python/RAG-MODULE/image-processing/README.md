# 🖼️ Image Processing Pipeline for RAG System

## Overview

This image processing pipeline extracts images from PDFs, performs OCR text extraction, and creates user-isolated image collections for the RAG system. It's designed to work seamlessly with the existing queue-based document processing architecture.

## Features

- ✅ **PDF Image Extraction**: Uses PyMuPDF to extract high-quality images
- ✅ **OCR Text Recognition**: Tesseract OCR for keyword extraction from images
- ✅ **User Isolation**: Maintains user-specific image collections
- ✅ **Session Support**: Groups images by session for better organization
- ✅ **Smart Filtering**: Filters out small decorative images
- ✅ **Base64 Encoding**: Converts images for easy storage and transmission
- ✅ **Fallback Keywords**: Generates contextual keywords when OCR fails
- ✅ **Docker Support**: Fully containerized with OCR dependencies

## Architecture

### Pipeline Flow
```
PDF Upload → Image Extraction → OCR Processing → Base64 Conversion → User Collection Storage
```

### User Isolation Structure
```
/app/data/collections/
├── user_123_456_789_images/
│   ├── session_abc123/
│   │   ├── img_1_0_uuid1.png
│   │   ├── img_1_1_uuid2.jpg
│   │   └── collection_metadata.json
│   └── default/
│       └── ...
└── user_987_654_321_images/
    └── ...
```

## Docker Setup

### 1. Build the Image Processing Container

```bash
# Build the container
docker build -f Docker/Dockerfile.image-processor -t productdemo-image-processor .

# Or use docker-compose
docker compose build image-processor
```

### 2. Test the Setup

```bash
# Run the comprehensive test suite
./Docker/test-image-processing.sh
```

### 3. Start the Service

```bash
# Start the image processing service
docker compose up -d image-processor

# Check logs
docker compose logs -f image-processor
```

## Usage

### Command Line Usage

```bash
# Basic usage
docker compose exec image-processor python image-processing/docker_image_processor.py \
  /path/to/document.pdf user-123-456-789

# With session ID
docker compose exec image-processor python image-processing/docker_image_processor.py \
  /path/to/document.pdf user-123-456-789 --session-id session-abc-123

# With custom filters
docker compose exec image-processor python image-processing/docker_image_processor.py \
  /path/to/document.pdf user-123-456-789 \
  --min-size-kb 10 --min-width 100 --min-height 100
```

### Python API Usage

```python
from docker_image_processor import UserIsolatedImageProcessor

# Initialize processor
processor = UserIsolatedImageProcessor("/app/data")

# Process PDF for a user
result = processor.extract_images_from_pdf(
    pdf_path="/path/to/document.pdf",
    user_id="user-123-456-789",
    session_id="session-abc-123",  # Optional
    min_size_kb=5,
    min_width=50,
    min_height=50
)

if result["success"]:
    print(f"Extracted {result['total_count']} images")
    for image in result["images"]:
        print(f"Image: {image['filename']}")
        print(f"Keywords: {image['keywords']}")
        print(f"Base64 length: {len(image['base64'])}")
else:
    print(f"Error: {result['error']}")
```

## Output Format

### Collection Metadata JSON
```json
{
  "user_id": "user-123-456-789",
  "session_id": "session-abc-123",
  "pdf_source": "/path/to/document.pdf",
  "total_images": 5,
  "created_at": "2024-01-15T10:30:00",
  "images": [
    {
      "image_id": "uuid-1234-5678",
      "user_id": "user-123-456-789",
      "session_id": "session-abc-123",
      "filename": "img_1_0_uuid1234.png",
      "page": 1,
      "index": 0,
      "dimensions": "800x600",
      "size_kb": 45.2,
      "format": "png",
      "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
      "keywords": "Chart showing quarterly sales data",
      "timestamp": "2024-01-15T10:30:15",
      "file_path": "/app/data/collections/user_123_456_789_images/session_abc_123/img_1_0_uuid1234.png"
    }
  ]
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TESSDATA_PREFIX` | `/usr/share/tesseract-ocr/5/tessdata/` | Tesseract data directory |
| `TESSERACT_CMD` | `/usr/bin/tesseract` | Tesseract executable path |
| `IMAGE_MIN_SIZE_KB` | `5` | Minimum image size in KB |
| `IMAGE_MIN_WIDTH` | `50` | Minimum image width in pixels |
| `IMAGE_MIN_HEIGHT` | `50` | Minimum image height in pixels |
| `OCR_CONFIG` | `--oem 3 --psm 6` | Tesseract OCR configuration |

### OCR Languages

The container includes support for multiple languages:
- English (eng) - Default
- French (fra)
- German (deu)
- Spanish (spa)
- Italian (ita)
- Portuguese (por)

## Integration with RAG System

### 1. Extend Document Processor

```javascript
// In src/services/documentProcessor.js
async processDocument(document, options = {}, onProgress = null) {
  // ... existing text processing ...
  
  // Add image processing
  const imageResult = await this.processDocumentImages(document, options);
  if (imageResult.success) {
    await reportProgress(60, `Processed ${imageResult.total_count} images`);
  }
  
  // ... continue with embeddings ...
}

async processDocumentImages(document, options = {}) {
  const { userId, sessionId } = options;
  
  // Call Docker container
  const result = await this.executeImageProcessor(
    document.file_path,
    userId,
    sessionId
  );
  
  return result;
}
```

### 2. Store in Vector Database

```javascript
// Store image metadata in ChromaDB alongside text chunks
await this.vectorStoreService.addDocumentImages(
  documentId,
  imageResult.images,
  {
    userId: userId,
    sessionId: sessionId,
    fileName: document.original_name
  }
);
```

## Troubleshooting

### Common Issues

1. **OCR Not Working**
   ```bash
   # Check Tesseract installation
   docker compose exec image-processor tesseract --version
   
   # Test OCR manually
   docker compose exec image-processor tesseract /path/to/image.png stdout
   ```

2. **Permission Issues**
   ```bash
   # Check file permissions
   docker compose exec image-processor ls -la /app/data/collections/
   
   # Fix permissions if needed
   docker compose exec image-processor chown -R imageprocessor:imageprocessor /app/data/
   ```

3. **Memory Issues**
   ```bash
   # Increase memory limits in docker-compose.yml
   deploy:
     resources:
       limits:
         memory: 4G  # Increase from 2G
   ```

## Performance Optimization

- **Batch Processing**: Process multiple images in parallel
- **Memory Management**: Use streaming for large images
- **Caching**: Cache OCR results for identical images
- **Compression**: Optimize image compression before base64 encoding

## Next Steps

1. **Integration Testing**: Test with real PDFs from your application
2. **Performance Tuning**: Optimize for your specific use case
3. **Monitoring**: Add metrics and logging
4. **Scaling**: Consider horizontal scaling for high-volume processing

## Support

For issues or questions:
1. Check the logs: `docker compose logs image-processor`
2. Run the test suite: `./Docker/test-image-processing.sh`
3. Verify OCR functionality with sample images
