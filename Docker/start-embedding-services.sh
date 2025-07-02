#!/bin/bash

# Embedding Services Startup Script
# This script starts the embedding service and related infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$SCRIPT_DIR/env.docker"
EMBEDDING_PORT=3579

echo -e "${BLUE}🚀 Starting Embedding Services...${NC}"

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed or not in PATH${NC}"
    exit 1
fi

# Function to check if Ollama is running
check_ollama() {
    local host=${1:-localhost}
    local port=${2:-11434}
    
    echo -e "${YELLOW}🔍 Checking Ollama availability at ${host}:${port}...${NC}"
    
    if curl -s --connect-timeout 5 "http://${host}:${port}/api/tags" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Ollama is accessible at ${host}:${port}${NC}"
        return 0
    else
        echo -e "${RED}❌ Ollama is not accessible at ${host}:${port}${NC}"
        echo -e "${YELLOW}💡 Make sure Ollama is running: ollama serve${NC}"
        return 1
    fi
}

# Function to check if embedding model is available
check_embedding_model() {
    local host=${1:-localhost}
    local port=${2:-11434}
    local model=${3:-nomic-embed-text}
    
    echo -e "${YELLOW}🔍 Checking if embedding model '${model}' is available...${NC}"
    
    if curl -s --connect-timeout 5 "http://${host}:${port}/api/tags" | grep -q "${model}"; then
        echo -e "${GREEN}✅ Model '${model}' is available${NC}"
        return 0
    else
        echo -e "${RED}❌ Model '${model}' is not available${NC}"
        echo -e "${YELLOW}💡 Pull the model: ollama pull ${model}${NC}"
        return 1
    fi
}

# Function to start services
start_services() {
    echo -e "${BLUE}🐳 Starting Docker services...${NC}"
    
    cd "$SCRIPT_DIR"
    
    # Start core services first
    echo -e "${YELLOW}📦 Starting Redis and ChromaDB...${NC}"
    docker-compose up -d redis chromadb
    
    # Wait for Redis to be healthy
    echo -e "${YELLOW}⏳ Waiting for Redis to be ready...${NC}"
    timeout 60 sh -c 'until docker-compose exec -T redis redis-cli ping | grep -q PONG; do sleep 1; done'
    
    # Start embedding service
    echo -e "${YELLOW}🧠 Starting Embedding Service...${NC}"
    docker-compose up -d embedding-service
    
    # Wait for embedding service to be healthy
    echo -e "${YELLOW}⏳ Waiting for Embedding Service to be ready...${NC}"
    timeout 60 sh -c "until curl -s http://localhost:${EMBEDDING_PORT}/health > /dev/null 2>&1; do sleep 2; done"
    
    # Start other services
    echo -e "${YELLOW}📦 Starting remaining services...${NC}"
    docker-compose up -d
    
    echo -e "${GREEN}✅ All services started successfully!${NC}"
}

# Function to show service status
show_status() {
    echo -e "${BLUE}📊 Service Status:${NC}"
    docker-compose ps
    
    echo -e "\n${BLUE}🔗 Service URLs:${NC}"
    echo -e "  • Embedding Service: ${GREEN}http://localhost:${EMBEDDING_PORT}${NC}"
    echo -e "  • Embedding Health: ${GREEN}http://localhost:${EMBEDDING_PORT}/health${NC}"
    echo -e "  • Embedding Config: ${GREEN}http://localhost:${EMBEDDING_PORT}/api/config${NC}"
    echo -e "  • Cache Stats: ${GREEN}http://localhost:${EMBEDDING_PORT}/api/cache/stats${NC}"
    echo -e "  • ChromaDB: ${GREEN}http://localhost:8001${NC}"
    echo -e "  • Redis: ${GREEN}localhost:6379${NC}"
    
    # Test embedding service
    echo -e "\n${BLUE}🧪 Testing Embedding Service:${NC}"
    if curl -s "http://localhost:${EMBEDDING_PORT}/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Embedding service is responding${NC}"
        
        # Show cache stats
        if cache_stats=$(curl -s "http://localhost:${EMBEDDING_PORT}/api/cache/stats" 2>/dev/null); then
            cached_count=$(echo "$cache_stats" | grep -o '"cached_embeddings":[0-9]*' | cut -d: -f2)
            echo -e "  📈 Cached embeddings: ${cached_count:-0}"
        fi
    else
        echo -e "${RED}❌ Embedding service is not responding${NC}"
    fi
}

# Function to test embedding generation
test_embedding() {
    echo -e "${BLUE}🧪 Testing Embedding Generation:${NC}"
    
    echo -e "${YELLOW}Testing single embedding...${NC}"
    response=$(curl -s -X POST "http://localhost:${EMBEDDING_PORT}/api/embeddings/single" \
        -H "Content-Type: application/json" \
        -d '{"text": "Hello, this is a test embedding!"}' 2>/dev/null)
    
    if echo "$response" | grep -q '"success":true'; then
        dimensions=$(echo "$response" | grep -o '"dimensions":[0-9]*' | cut -d: -f2)
        cached=$(echo "$response" | grep -o '"cached":[a-z]*' | cut -d: -f2)
        echo -e "${GREEN}✅ Single embedding test passed${NC}"
        echo -e "   Dimensions: ${dimensions:-unknown}"
        echo -e "   Cached: ${cached:-false}"
    else
        echo -e "${RED}❌ Single embedding test failed${NC}"
        echo -e "   Response: $response"
    fi
}

# Main execution
main() {
    case "${1:-start}" in
        "start")
            check_ollama "localhost" "11434"
            check_embedding_model "localhost" "11434" "nomic-embed-text"
            start_services
            show_status
            ;;
        "status")
            show_status
            ;;
        "test")
            test_embedding
            ;;
        "stop")
            echo -e "${YELLOW}🛑 Stopping services...${NC}"
            cd "$SCRIPT_DIR"
            docker-compose down
            echo -e "${GREEN}✅ Services stopped${NC}"
            ;;
        "restart")
            echo -e "${YELLOW}🔄 Restarting services...${NC}"
            cd "$SCRIPT_DIR"
            docker-compose restart
            show_status
            ;;
        "logs")
            cd "$SCRIPT_DIR"
            docker-compose logs -f embedding-service
            ;;
        "build")
            echo -e "${YELLOW}🔨 Building embedding service image...${NC}"
            cd "$SCRIPT_DIR"
            docker-compose build embedding-service
            echo -e "${GREEN}✅ Embedding service image built${NC}"
            ;;
        *)
            echo -e "${BLUE}Usage: $0 {start|stop|restart|status|test|logs|build}${NC}"
            echo -e "  start   - Start all embedding services"
            echo -e "  stop    - Stop all services"
            echo -e "  restart - Restart all services"
            echo -e "  status  - Show service status and URLs"
            echo -e "  test    - Test embedding generation"
            echo -e "  logs    - Show embedding service logs"
            echo -e "  build   - Build embedding service Docker image"
            exit 1
            ;;
    esac
}

main "$@" 