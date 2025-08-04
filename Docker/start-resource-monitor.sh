#!/bin/bash

# Start Resource Monitor Service
echo "🚀 Starting Resource Monitor Service..."

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

# Build and start the resource monitor service
echo "🔨 Building resource monitor service..."
docker-compose build resource-monitor

if [ $? -eq 0 ]; then
    echo "✅ Resource monitor service built successfully!"
    
    echo "🚀 Starting resource monitor service..."
    docker-compose up resource-monitor -d
    
    # Wait a moment for the service to start
    sleep 5
    
    # Check if the service is running
    if docker-compose ps resource-monitor | grep -q "Up"; then
        echo "✅ Resource monitor service is running successfully!"
        echo "🌐 Resource monitor dashboard: http://localhost:8005"
        echo "📊 API endpoint: http://localhost:8005/api/data"
        
        # Show service logs
        echo ""
        echo "📋 Service logs:"
        docker-compose logs resource-monitor --tail=10
    else
        echo "❌ Resource monitor service failed to start properly."
        docker-compose logs resource-monitor
        exit 1
    fi
else
    echo "❌ Resource monitor service build failed!"
    exit 1
fi

echo ""
echo "🎉 Resource monitor service started successfully!"
echo "💡 To view logs: docker-compose logs -f resource-monitor"
echo "💡 To stop: docker-compose stop resource-monitor" 