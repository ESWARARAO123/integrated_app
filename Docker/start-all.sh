#!/bin/bash

# Start All PinnacleAi Services with Resource Monitoring
echo "🚀 Starting PinnacleAi with Resource Monitoring..."

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found. Please run this script from the Docker directory."
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Load environment variables
if [ -f "docker.env" ]; then
    echo "📋 Loading environment variables from docker.env..."
    export $(cat docker.env | grep -v '^#' | xargs)
else
    echo "⚠️  Warning: docker.env not found. Using default values."
fi

# Stop any existing containers
echo "🧹 Stopping existing containers..."
docker-compose down --remove-orphans

# Build all services
echo "🔨 Building all services..."
docker-compose build

if [ $? -eq 0 ]; then
    echo "✅ All services built successfully!"
    
    # Start all services
    echo "🚀 Starting all services..."
    docker-compose up -d
    
    # Wait for services to start
    echo "⏳ Waiting for services to start..."
    sleep 15
    
    # Check service status
    echo "📊 Service Status:"
    docker-compose ps
    
    # Check if key services are running
    echo ""
    echo "🔍 Checking key services..."
    
    # Check resource monitor
    if docker-compose ps resource-monitor | grep -q "Up"; then
        echo "✅ Resource Monitor: Running on http://localhost:${RESOURCE_MONITOR_PORT:-8005}"
    else
        echo "❌ Resource Monitor: Failed to start"
    fi
    
    # Check main app
    if docker-compose ps app | grep -q "Up"; then
        echo "✅ Main Application: Running on http://localhost:${APP_PORT:-4342}"
    else
        echo "❌ Main Application: Failed to start"
    fi
    
    # Check ChromaDB
    if docker-compose ps chromadb | grep -q "Up"; then
        echo "✅ ChromaDB: Running on http://localhost:${CHROMADB_HOST_PORT:-8001}"
    else
        echo "❌ ChromaDB: Failed to start"
    fi
    
    # Check Redis
    if docker-compose ps redis | grep -q "Up"; then
        echo "✅ Redis: Running on localhost:${REDIS_HOST_PORT:-6379}"
    else
        echo "❌ Redis: Failed to start"
    fi
    
    echo ""
    echo "🎉 PinnacleAi with Resource Monitoring is now running!"
    echo ""
    echo "📱 Access Points:"
    echo "   🌐 Main Application: http://localhost:${APP_PORT:-4342}"
    echo "   📊 Resource Monitor: http://localhost:${RESOURCE_MONITOR_PORT:-8005}"
    echo "   🗄️  ChromaDB: http://localhost:${CHROMADB_HOST_PORT:-8001}"
    echo "   🔴 Redis: localhost:${REDIS_HOST_PORT:-6379}"
    echo ""
    echo "🔧 Management Commands:"
    echo "   📋 View logs: docker-compose logs -f [service-name]"
    echo "   🛑 Stop all: docker-compose down"
    echo "   🔄 Restart: docker-compose restart [service-name]"
    echo "   📊 Status: docker-compose ps"
    echo ""
    echo "💡 Resource Monitoring Features:"
    echo "   • Real-time CPU, Memory, Disk monitoring"
    echo "   • Multi-server support"
    echo "   • System alerts and notifications"
    echo "   • Access via Resource button in main app"
    echo "   • Access via Settings → Resource Details"
    
else
    echo "❌ Service build failed!"
    echo "📋 Build logs:"
    docker-compose logs --tail=20
    exit 1
fi 