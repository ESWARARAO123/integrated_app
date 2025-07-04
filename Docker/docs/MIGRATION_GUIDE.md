# Migration Guide: Local Python to Containerized Text Processing

This guide outlines the process for migrating from local Python script execution to the containerized Text Processing Service for the RAG system.

## Overview

The RAG system currently uses local Python processes for text extraction from documents, which creates several issues:

1. **Single-threaded execution** - Only one document can be processed at a time
2. **Host dependencies** - Requires Python and dependencies installed on the host
3. **Limited scalability** - Cannot scale horizontally across multiple machines
4. **Resource contention** - Competes with other processes for host resources

The new Text Processing Service addresses these issues by:

1. **Containerized execution** - Runs in an isolated Docker container
2. **REST API interface** - Provides HTTP endpoints for text extraction
3. **Horizontal scaling** - Can be scaled to multiple instances
4. **Resource isolation** - Container has dedicated CPU and memory limits

## Migration Steps

### 1. Preparation

Before migrating, ensure you have:

- Docker and Docker Compose installed
- Access to the Docker registry (if using private images)
- Sufficient disk space for container images
- Network connectivity between application and container services

### 2. Build and Deploy the Text Processing Service

```bash
# Navigate to the Docker directory
cd Docker

# Build the text processor image
docker-compose build text-processor

# Start the service
docker-compose up -d text-processor

# Verify the service is running
docker-compose ps text-processor
curl http://localhost:3580/health
```

### 3. Configure the Application

Add the following configuration to your `config.ini` file:

```ini
[text_processor]
use_service = true
url = http://localhost:3580
extract_tables = true
fallback_enabled = true
```

These settings control:
- `use_service`: Whether to use the containerized service (true) or local Python (false)
- `url`: The URL of the text processing service
- `extract_tables`: Whether to use the table extraction endpoint
- `fallback_enabled`: Whether to fall back to local Python if the service fails

### 4. Testing the Migration

1. **Parallel Testing**:
   Run both methods side-by-side and compare results:

   ```javascript
   // Test both extraction methods
   const serviceResult = await documentProcessor.extractTextWithService(filePath);
   const localResult = await documentProcessor.extractTextSmart(filePath);
   
   console.log('Service result length:', serviceResult.text.length);
   console.log('Local result length:', localResult.text.length);
   ```

2. **Gradual Rollout**:
   Enable the service for a percentage of requests:

   ```javascript
   // Gradual rollout
   const useService = Math.random() < 0.2; // 20% of requests use service
   ```

3. **A/B Testing**:
   Compare performance metrics between the two methods:
   - Processing time
   - Memory usage
   - Failure rate
   - Text quality

### 5. Monitoring and Troubleshooting

1. **Container Logs**:
   ```bash
   docker-compose logs -f text-processor
   ```

2. **Health Checks**:
   ```bash
   curl http://localhost:3580/health
   ```

3. **Performance Monitoring**:
   ```bash
   docker stats text-processor
   ```

4. **Common Issues**:

   | Issue | Solution |
   |-------|----------|
   | Service unavailable | Check if container is running and healthy |
   | Timeout errors | Increase timeout settings or container resources |
   | Memory errors | Increase container memory limit |
   | Different text output | Check for version differences in Python libraries |

### 6. Scaling the Service

To handle higher load, scale the text processor service:

```bash
# Scale to 3 instances
docker-compose up -d --scale text-processor=3

# Add load balancing with Nginx
# See Docker/nginx/text-processor.conf for configuration
```

### 7. Fallback Mechanism

The system includes a fallback mechanism that will automatically use local Python execution if the containerized service fails. This ensures reliability during the migration period.

To control fallback behavior:

```ini
[text_processor]
fallback_enabled = true
fallback_timeout = 30000
```

The code will:
1. Try the containerized service first
2. If it fails or times out, fall back to local Python
3. Log the failure and success/failure of the fallback

### 8. Complete Migration

Once you're confident in the containerized service:

1. Set `fallback_enabled = false` to disable the fallback
2. Monitor for any issues
3. Remove the local Python execution code if no longer needed

## Performance Comparison

| Metric | Local Python | Containerized Service |
|--------|--------------|----------------------|
| Processing Time | 15-30s per document | 5-15s per document |
| Concurrent Processing | 1 document | Multiple documents |
| Memory Usage | Shared with host | Isolated (1GB limit) |
| CPU Usage | Unlimited | Limited (1 CPU) |
| Scalability | None | Horizontal |
| Failure Isolation | None | Complete |

## Rollback Plan

If issues arise with the containerized service:

1. Set `use_service = false` in config.ini
2. Restart the application
3. The system will revert to using local Python execution
4. Fix issues with the containerized service
5. Re-enable with `use_service = true`

## Future Improvements

After successful migration:

1. **Queue-based processing** - Add Redis queue for asynchronous processing
2. **Auto-scaling** - Implement container auto-scaling based on queue depth
3. **Multi-region deployment** - Deploy services across multiple regions
4. **Advanced monitoring** - Add detailed metrics and alerting
5. **Enhanced extraction** - Add more specialized extraction endpoints 