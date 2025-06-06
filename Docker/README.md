# 🐳 Docker Setup Guide - Product Demo Platform

This guide provides complete instructions for setting up and running the Product Demo Platform using Docker, including the new **BullMQ-based document processing queue system**.

## 📋 Table of Contents

- [🏗️ System Architecture](#️-system-architecture)
- [📦 Prerequisites](#-prerequisites)
- [🚀 Quick Start](#-quick-start)
- [⚙️ Configuration](#️-configuration)
- [🔧 Services Overview](#-services-overview)
- [📊 Database Setup](#-database-setup)
- [🔄 Document Queue System](#-document-queue-system)
- [🌐 Environment Variables](#-environment-variables)
- [🛠️ Development Setup](#️-development-setup)
- [📈 Monitoring & Logs](#-monitoring--logs)
- [🔍 Troubleshooting](#-troubleshooting)
- [🚀 Production Deployment](#-production-deployment)

---

## 🏗️ System Architecture

### **Hybrid Containerization Approach**

This application uses a **hybrid containerization strategy** where:
- **Core infrastructure services** (Redis, ChromaDB) are containerized
- **Document processing workers** are containerized for scalability
- **Main application** (Backend + Frontend) runs on the host system
- **Database** can be either containerized or use host PostgreSQL

```
┌─────────────────────────────────────────────────────────────┐
│                    HOST SYSTEM                              │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   Backend       │    │   PostgreSQL    │                │
│  │   (Node.js)     │◄──►│   (Host/Docker) │                │
│  │   Port: 5634    │    │   Port: 5432    │                │
│  │                 │    └─────────────────┘                │
│  │  Serves Frontend│                                        │
│  │  Build Files    │    ┌─────────────────┐                │
│  │  (React SPA)    │    │   Ollama/LLM    │                │
│  └─────────────────┘    │   (Host System) │                │
│           │              │   Port: 11434   │                │
│           │              └─────────────────┘                │
│           │                                                 │
│  ┌────────▼────────────────────────────────────────────────┤
│  │              DOCKER CONTAINERS                          │
│  │  ┌─────────────────┐    ┌─────────────────┐            │
│  │  │     Redis       │    │    ChromaDB     │            │
│  │  │   (Queue)       │    │  (Vector Store) │            │
│  │  │   Port: 6379    │    │   Port: 8000    │            │
│  │  └─────────────────┘    └─────────────────┘            │
│  │           │                       │                     │
│  │  ┌─────────▼───────────────────────▼─────┐              │
│  │  │        Document Workers               │              │
│  │  │        (BullMQ Workers)               │              │
│  │  │        3-5 Scalable Instances         │              │
│  │  └───────────────────────────────────────┘              │
│  └─────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
```

### **Key Architectural Points**

1. **Single Port Access**: The entire application is accessible via **one port** (5634)
2. **Backend Serves Frontend**: Node.js backend serves the React build files as static content
3. **API + SPA**: All API routes are under `/api/*`, frontend routes handled by React Router
4. **Containerized Workers**: Only the document processing workers are containerized for scalability
5. **External LLM Integration**: Ollama/LLM services run on the host system, not in containers

---

## 📦 Prerequisites

### Required Software
- **Docker**: Version 20.0+ ([Download](https://docs.docker.com/get-docker/))
- **Docker Compose**: Version 2.0+ (included with Docker Desktop)
- **Node.js**: Version 18+ (for running the main application)
- **PostgreSQL**: Either host installation or Docker container
- **Ollama**: For LLM integration (host installation recommended)

### System Requirements
- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: 10GB free space
- **CPU**: 4+ cores recommended
- **Network**: Internet connection for downloading dependencies

### Verify Installation
```bash
# Check Docker version
docker --version
# Should output: Docker version 20.x.x or higher

# Check Node.js version
node --version
# Should output: v18.x.x or higher

# Check PostgreSQL (if using host installation)
psql --version
# Should output: psql (PostgreSQL) 12.x or higher
```

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd productdemo
```

### 2. Choose Your Database Setup

#### Option A: Use Host PostgreSQL (Recommended for Production)
```bash
# Install PostgreSQL on your system if not already installed
# Create database and user
createdb productdemo
createuser productdemo_user
```

#### Option B: Use Docker PostgreSQL (Easier for Development)
```bash
# Add PostgreSQL service to docker-compose.yml (see Configuration section)
```

### 3. Install Application Dependencies
```bash
# Install backend dependencies
npm install

# Build frontend
cd client
npm install
npm run build
cd ..
```

### 4. Configure Environment
```bash
# Copy and edit configuration
cp conf/config.ini conf/config.local.ini
# Edit conf/config.local.ini with your database settings

# For Docker services
cp Docker/env.docker .env
# Edit .env if needed
```

### 5. Start Infrastructure Services
```bash
# Start only the containerized services (Redis, ChromaDB, Workers)
cd Docker
docker compose up -d

# Verify services are running
docker compose ps
```

### 6. Initialize Database
```bash
# Run from project root
npm run db:migrate
npm run db:migrate:queue
```

### 7. Start the Main Application
```bash
# Start the backend (which serves the frontend)
npm start

# Or for development with auto-reload
npm run dev
```

### 8. Access the Application
- **Complete Application**: http://localhost:5634
- **API Endpoints**: http://localhost:5634/api/*
- **Frontend SPA**: Served automatically by backend

---

## ⚙️ Configuration

### Database Configuration Options

#### Option 1: Host PostgreSQL (Production Recommended)
```ini
# conf/config.ini
[database]
database-type = postgres
database-host = localhost
database-port = 5432
database-user = productdemo_user
database-password = your_secure_password
database-name = productdemo
```

#### Option 2: Docker PostgreSQL (Development)
Add to `Docker/docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: productdemo-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: productdemo
      POSTGRES_USER: productdemo_user
      POSTGRES_PASSWORD: your_secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - productdemo-network

volumes:
  postgres_data:
    driver: local
```

Then update config:
```ini
[database]
database-host = localhost  # Still localhost since port is exposed
```

### LLM/Ollama Integration

#### Host Ollama Setup (Recommended)
```bash
# Install Ollama on your host system
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve

# Pull required models
ollama pull llama2
ollama pull codellama
```

Configuration:
```ini
# conf/config.ini
[ai]
ollama_host = http://localhost:11434  # Host system Ollama
```

#### Docker Ollama Setup (Alternative)
```yaml
# Add to docker-compose.yml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: productdemo-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped
    networks:
      - productdemo-network
```

Configuration:
```ini
[ai]
ollama_host = http://localhost:11434  # Docker Ollama via exposed port
```

### Frontend Build Configuration

The backend automatically serves the frontend build files:

```ini
# conf/config.ini
[server]
static_root_path = ./client/build  # Path to React build files
serve_static = true
```

**Important**: Always run `npm run build` in the client directory after frontend changes!

---

## 🔧 Services Overview

### 1. Main Application (Host)
- **Port**: 5634 (configurable)
- **Components**: 
  - Node.js Backend (API server, WebSocket)
  - React Frontend (served as static files)
- **Purpose**: Main application logic, user interface
- **Access**: http://localhost:5634

### 2. Redis (Containerized)
- **Port**: 6379
- **Purpose**: Queue management for BullMQ, session storage
- **Container**: `productdemo-redis`
- **Scaling**: Single instance sufficient

### 3. ChromaDB (Containerized)
- **Port**: 8000
- **Purpose**: Vector database for document embeddings
- **Container**: `productdemo-chromadb`
- **Data**: Persistent storage in `./DATA/chroma_data`

### 4. Document Workers (Containerized)
- **Purpose**: Asynchronous document processing
- **Container**: `productdemo-doc-workers`
- **Scaling**: Horizontal scaling supported (1-10 instances)
- **Features**: PDF/DOCX parsing, embedding generation

### 5. PostgreSQL (Host or Container)
- **Port**: 5432
- **Purpose**: Primary application database
- **Options**: Host installation (recommended) or containerized
- **Data**: User accounts, chat sessions, document metadata

### 6. Ollama/LLM (Host Recommended)
- **Port**: 11434
- **Purpose**: Large Language Model inference
- **Recommendation**: Host installation for better performance
- **Models**: Configurable (llama2, codellama, etc.)

---

## 📊 Database Setup

### Host PostgreSQL Setup (Recommended)

```bash
# 1. Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# 2. Create database and user
sudo -u postgres psql
CREATE DATABASE productdemo;
CREATE USER productdemo_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE productdemo TO productdemo_user;
\q

# 3. Update configuration
# Edit conf/config.ini with the database details

# 4. Run migrations
npm run db:migrate
npm run db:migrate:queue
```

### Docker PostgreSQL Setup

```bash
# 1. Add PostgreSQL to docker-compose.yml (see Configuration section)

# 2. Start PostgreSQL container
cd Docker
docker compose up -d postgres

# 3. Wait for database to be ready
docker compose logs postgres

# 4. Run migrations
cd ..
npm run db:migrate
npm run db:migrate:queue
```

### Database Management

```bash
# Connect to host PostgreSQL
psql -h localhost -U productdemo_user -d productdemo

# Connect to Docker PostgreSQL
docker compose exec postgres psql -U productdemo_user -d productdemo

# Backup database
pg_dump -h localhost -U productdemo_user productdemo > backup.sql

# Restore database
psql -h localhost -U productdemo_user productdemo < backup.sql
```

---

## 🔄 Document Queue System

### Architecture
```
Frontend Upload → Backend API → Redis Queue → Docker Workers → ChromaDB
     ↓              ↓              ↓              ↓              ↓
   User UI      Queue Job      BullMQ         Processing    Vector Storage
                Creation       Management      (PDF/DOCX)    (Embeddings)
```

### Worker Management

```bash
# Start workers
cd Docker
docker compose up -d doc-workers

# Scale workers (increase processing capacity)
docker compose up -d --scale doc-workers=5

# View worker logs
docker compose logs -f doc-workers

# Restart workers
docker compose restart doc-workers

# Stop workers
docker compose stop doc-workers
```

### Queue Monitoring

```bash
# Check queue status via API
curl http://localhost:5634/api/documents/processing-status

# Monitor Redis queue directly
docker compose exec redis redis-cli
> KEYS bull:document-processing:*
> LLEN bull:document-processing:waiting
> LLEN bull:document-processing:active
```

---

## 🌐 Environment Variables

### Application Environment (.env)
```bash
# Redis Configuration (for Docker services)
REDIS_HOST=redis
REDIS_PORT=6379

# Document Queue Configuration
DOC_WORKER_CONCURRENCY=3
QUEUE_MAX_RETRIES=3

# ChromaDB Configuration
CHROMADB_HOST=chromadb
CHROMADB_PORT=8000

# Database Configuration (if using Docker PostgreSQL)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=productdemo
DATABASE_USER=productdemo_user
DATABASE_PASSWORD=your_secure_password
```

### Configuration File (conf/config.ini)
```ini
[server]
port = 5634
static_root_path = ./client/build

[database]
database-type = postgres
database-host = localhost
database-port = 5432
database-name = productdemo
database-user = productdemo_user
database-password = your_secure_password

[redis]
host = localhost
port = 6379

[ai]
ollama_host = http://localhost:11434
```

---

## 🛠️ Development Setup

### Full Local Development
```bash
# 1. Start infrastructure services only
cd Docker
docker compose up -d redis chromadb

# 2. Install dependencies
cd ..
npm install
cd client && npm install && cd ..

# 3. Build frontend
cd client && npm run build && cd ..

# 4. Start backend in development mode
npm run dev

# 5. For frontend development (separate terminal)
cd client && npm start
# This runs on port 3000 for hot reload
```

### Production-like Development
```bash
# 1. Start all infrastructure
cd Docker
docker compose up -d

# 2. Build frontend
cd client && npm run build && cd ..

# 3. Start backend
npm start
# Access complete app on http://localhost:5634
```

### Code Changes Workflow

#### Frontend Changes
```bash
# 1. Make changes in client/src/
# 2. Build frontend
cd client && npm run build && cd ..
# 3. Restart backend to serve new build
npm run dev  # or restart if using npm start
```

#### Backend Changes
```bash
# 1. Make changes in src/
# 2. Restart backend (auto-restart with npm run dev)
```

#### Worker Changes
```bash
# 1. Make changes to worker code
# 2. Rebuild and restart workers
cd Docker
docker compose build doc-workers
docker compose restart doc-workers
```

---

## 📈 Monitoring & Logs

### Application Logs
```bash
# Backend logs (main application)
tail -f logs/app.log

# Development logs (console)
npm run dev  # Shows logs in console

# Worker logs
cd Docker
docker compose logs -f doc-workers
```

### Service Health Checks
```bash
# Main application health
curl http://localhost:5634/api/health

# Redis health
docker compose exec redis redis-cli ping

# ChromaDB health
curl http://localhost:8000/api/v1/heartbeat

# PostgreSQL health (host)
pg_isready -h localhost -p 5432

# PostgreSQL health (Docker)
docker compose exec postgres pg_isready
```

### Performance Monitoring
```bash
# Application resource usage
ps aux | grep node

# Docker container resources
docker stats

# Database connections
# Connect to PostgreSQL and run:
SELECT count(*) FROM pg_stat_activity;
```

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Frontend Not Loading
```bash
# Check if build exists
ls -la client/build/

# Rebuild frontend
cd client && npm run build && cd ..

# Check backend static file serving
curl http://localhost:5634/
```

#### 2. API Routes Not Working
```bash
# Check if backend is running
curl http://localhost:5634/api/health

# Check backend logs
tail -f logs/app.log

# Verify API prefix
curl http://localhost:5634/api/users/me
```

#### 3. Database Connection Issues
```bash
# Test PostgreSQL connection
psql -h localhost -U productdemo_user -d productdemo -c "SELECT 1;"

# Check database configuration
cat conf/config.ini | grep -A 10 "\[database\]"

# Verify database exists
psql -h localhost -U productdemo_user -l
```

#### 4. Document Processing Not Working
```bash
# Check workers are running
cd Docker && docker compose ps

# Check Redis connection
docker compose exec redis redis-cli ping

# Check ChromaDB connection
curl http://localhost:8000/api/v1/heartbeat

# View worker logs
docker compose logs doc-workers
```

#### 5. Ollama/LLM Integration Issues
```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Test Ollama connection
ollama list

# Check configuration
cat conf/config.ini | grep -A 5 "\[ai\]"
```

### Debug Commands
```bash
# Check all processes
ps aux | grep -E "(node|postgres|redis|ollama)"

# Check port usage
netstat -tulpn | grep -E "(5634|5432|6379|8000|11434)"

# Check Docker services
cd Docker && docker compose ps

# Test database migrations
npm run db:migrate -- --dry-run
```

---

## 🚀 Production Deployment

### Pre-deployment Checklist
- [ ] PostgreSQL installed and configured on host
- [ ] Ollama installed and models downloaded
- [ ] Frontend built (`npm run build`)
- [ ] Database migrations applied
- [ ] Configuration files updated with production values
- [ ] SSL certificates configured (if needed)
- [ ] Firewall rules configured
- [ ] Backup strategy implemented

### Production Environment Setup

#### 1. System Preparation
```bash
# Install Node.js (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh
```

#### 2. Application Deployment
```bash
# Clone and setup application
git clone <repository-url> /opt/productdemo
cd /opt/productdemo

# Install dependencies
npm install
cd client && npm install && npm run build && cd ..

# Setup database
sudo -u postgres createdb productdemo
sudo -u postgres createuser productdemo_user
# Set password and permissions

# Run migrations
npm run db:migrate
npm run db:migrate:queue

# Start infrastructure services
cd Docker && docker compose up -d

# Start application (consider using PM2 for production)
npm install -g pm2
pm2 start src/server.js --name "productdemo"
pm2 startup
pm2 save
```

#### 3. Reverse Proxy Setup (Nginx)
```nginx
# /etc/nginx/sites-available/productdemo
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5634;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Security Considerations

1. **Database Security**
   - Use strong passwords
   - Restrict database access to localhost
   - Enable SSL connections

2. **Application Security**
   - Update `secret_key` in config
   - Enable HTTPS in production
   - Configure proper CORS origins

3. **Docker Security**
   - Keep Docker images updated
   - Use non-root users in containers
   - Limit container resources

4. **System Security**
   - Keep system packages updated
   - Configure firewall (ufw/iptables)
   - Regular security audits

### Backup Strategy

```bash
#!/bin/bash
# backup.sh - Production backup script

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/productdemo"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -h localhost -U productdemo_user productdemo > "$BACKUP_DIR/db_$DATE.sql"

# Application data backup
tar -czf "$BACKUP_DIR/data_$DATE.tar.gz" /opt/productdemo/DATA

# Redis backup (if needed)
docker exec productdemo-redis redis-cli BGSAVE
cp /var/lib/docker/volumes/docker_redis_data/_data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Scaling Considerations

#### Horizontal Scaling
```bash
# Scale document workers
cd Docker
docker compose up -d --scale doc-workers=10

# Scale application (requires load balancer)
# Run multiple instances on different ports
# Use Nginx/HAProxy for load balancing
```

#### Vertical Scaling
```bash
# Increase worker resources
# Edit docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '2.0'
```

---

## 📞 Support & Resources

### Architecture Summary

**What's Containerized:**
- ✅ Redis (Queue management)
- ✅ ChromaDB (Vector database)
- ✅ Document Workers (Processing)

**What's on Host:**
- ✅ Main Application (Backend + Frontend)
- ✅ PostgreSQL (Recommended)
- ✅ Ollama/LLM Services

**Why This Architecture:**
- **Performance**: Host services avoid container overhead
- **Simplicity**: Single port access, easier deployment
- **Flexibility**: Easy to scale workers independently
- **Development**: Faster iteration on main application code

### Quick Reference Commands

```bash
# === APPLICATION MANAGEMENT ===
npm start                        # Start main application
npm run dev                      # Development mode with auto-reload
npm run build                    # Build frontend only
cd client && npm run build       # Build frontend from client directory

# === DOCKER SERVICES ===
cd Docker && docker compose up -d              # Start infrastructure
docker compose ps                              # Check service status
docker compose logs -f doc-workers            # View worker logs
docker compose up -d --scale doc-workers=5    # Scale workers

# === DATABASE MANAGEMENT ===
npm run db:migrate               # Run database migrations
npm run db:migrate:queue         # Apply queue schema
psql -h localhost -U productdemo_user productdemo  # Connect to database

# === MONITORING ===
curl http://localhost:5634/api/health          # Application health
docker compose exec redis redis-cli ping       # Redis health
curl http://localhost:8000/api/v1/heartbeat   # ChromaDB health
```

### Getting Help

1. **Check Application Logs**: `tail -f logs/app.log`
2. **Verify Services**: `cd Docker && docker compose ps`
3. **Test Connectivity**: `curl http://localhost:5634/api/health`
4. **Check Configuration**: Review `conf/config.ini`
5. **Database Issues**: Test with `psql` connection
6. **Frontend Issues**: Rebuild with `cd client && npm run build`

---

## 🎯 Next Steps

After successful setup:

1. **Access Application**: http://localhost:5634
2. **Create Admin Account**: Use the frontend interface
3. **Upload Test Document**: Verify queue processing works
4. **Configure LLM Models**: Set up Ollama with required models
5. **Monitor Performance**: Check logs and resource usage
6. **Set Up Backups**: Implement automated backup strategy
7. **Scale Workers**: Adjust based on document processing load

---

*Last Updated: 2025-01-27*
*Version: 2.0.0 (Hybrid Architecture with BullMQ Queue System)*

**Key Architecture Points:**
- 🎯 **Single Port Access**: Everything via port 5634
- 🏗️ **Backend Serves Frontend**: No separate frontend server needed
- 🐳 **Selective Containerization**: Only infrastructure and workers
- 🚀 **Host Performance**: Main app and database on host for speed
- 📈 **Scalable Workers**: Docker containers for document processing

For additional support, please check the project documentation or create an issue in the repository. 