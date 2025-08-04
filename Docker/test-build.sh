#!/bin/bash

# Test Docker Build Script for PinnacleAi
echo "🚀 Testing Docker build for PinnacleAi..."

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found. Please run this script from the Docker directory."
    exit 1
fi

# Clean up any existing containers and images
echo "🧹 Cleaning up existing containers and images..."
docker-compose down --remove-orphans
docker system prune -f

# Build the app service specifically
echo "🔨 Building app service..."
docker-compose build app

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ App service built successfully!"
    
    # Test running the app service
    echo "🧪 Testing app service startup..."
    docker-compose up app -d
    
    # Wait a moment for the service to start
    sleep 10
    
    # Check if the service is running
    if docker-compose ps app | grep -q "Up"; then
        echo "✅ App service is running successfully!"
        echo "🌐 You can access the application at http://localhost:5641"
        
        # Stop the service
        docker-compose down
        echo "🛑 Service stopped for testing."
    else
        echo "❌ App service failed to start properly."
        docker-compose logs app
        docker-compose down
        exit 1
    fi
else
    echo "❌ App service build failed!"
    exit 1
fi

echo "🎉 Docker build test completed successfully!" 