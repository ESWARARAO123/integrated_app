# Docker Build Troubleshooting Guide

## Common Issues and Solutions

### 1. Cross-env Permission Denied Error

**Error:**
```
sh: 1: cross-env: Permission denied
```

**Solution:**
The build script has been updated to avoid cross-env dependency. The package.json now uses:
```json
"build": "DISABLE_ESLINT_PLUGIN=true react-scripts build"
```

### 2. Build Process Steps

1. **Clean up existing containers:**
   ```bash
   cd /path/to/PinnacleAi/Docker
   docker-compose down --remove-orphans
   docker system prune -f
   ```

2. **Build the application:**
   ```bash
   docker-compose build app
   ```

3. **Test the build:**
   ```bash
   ./test-build.sh
   ```

### 3. Alternative Dockerfile

If you continue to have issues, use the alternative Dockerfile:
```bash
# Rename the fixed version
mv Dockerfile.app.fixed Dockerfile.app
docker-compose build app
```

### 4. Manual Build Steps

If Docker build continues to fail, you can build manually:

1. **Build the client locally:**
   ```bash
   cd /path/to/PinnacleAi/client
   npm install
   DISABLE_ESLINT_PLUGIN=true npm run build
   ```

2. **Then build Docker:**
   ```bash
   cd /path/to/PinnacleAi/Docker
   docker-compose build app
   ```

### 5. Environment Variables

Make sure these environment variables are set in your `.env` file:
```bash
HOST_MACHINE_IP=172.16.16.21
APP_PORT=5641
CHROMADB_HOST_PORT=8001
REDIS_HOST_PORT=6379
EMBEDDING_HOST_PORT=3579
TEXT_PROCESSOR_PORT=3580
MCP_ORCHESTRATOR_PORT=3581
DIR_CREATE_PORT=3582
IMAGE_PROCESSOR_PORT=8430
CHAT2SQL_PORT=5000
RUNSTATUS_PORT=5003
PREDICTION_PORT=8088
```

### 6. Network Issues

If you encounter network-related issues:

1. **Check Docker network:**
   ```bash
   docker network ls
   docker network inspect productdemo-network
   ```

2. **Recreate network:**
   ```bash
   docker-compose down
   docker network rm productdemo-network
   docker-compose up -d
   ```

### 7. Volume Permissions

If you have volume permission issues:

```bash
# Fix permissions for mounted volumes
sudo chown -R 1000:1000 /path/to/PinnacleAi/DATA
sudo chown -R 1000:1000 /path/to/PinnacleAi/logs
```

### 8. Complete Reset

If all else fails, perform a complete reset:

```bash
# Stop all containers
docker-compose down

# Remove all images
docker rmi $(docker images -q)

# Remove all volumes
docker volume prune -f

# Remove all networks
docker network prune -f

# Rebuild everything
docker-compose build --no-cache
docker-compose up -d
```

### 9. Logs and Debugging

To debug issues:

```bash
# View logs for specific service
docker-compose logs app

# Follow logs in real-time
docker-compose logs -f app

# Check container status
docker-compose ps

# Enter container for debugging
docker-compose exec app bash
```

### 10. Resource Requirements

Ensure your system has sufficient resources:
- **RAM:** At least 8GB available
- **Disk Space:** At least 10GB free space
- **CPU:** At least 2 cores recommended

### 11. Docker Version

Make sure you're using a recent version of Docker:
```bash
docker --version
docker-compose --version
```

Recommended versions:
- Docker: 20.10+
- Docker Compose: 2.0+

### 12. Success Indicators

When the build is successful, you should see:
- ✅ All services building without errors
- ✅ App service starting successfully
- ✅ Application accessible at http://localhost:5641
- ✅ All dependent services (Redis, ChromaDB, etc.) running

## Quick Start Commands

```bash
# Navigate to Docker directory
cd /path/to/PinnacleAi/Docker

# Clean and build
./test-build.sh

# Or manually
docker-compose down --remove-orphans
docker-compose build app
docker-compose up -d

# Check status
docker-compose ps
```

## Support

If you continue to experience issues:
1. Check the logs: `docker-compose logs app`
2. Verify your environment setup
3. Ensure all dependencies are properly installed
4. Check system resources and Docker configuration 