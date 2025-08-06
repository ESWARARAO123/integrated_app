#!/bin/bash

# PinnacleAi Resource Server Startup Script
echo "🚀 Starting PinnacleAi Resource Server..."

# Check if Python 3 is available
if command -v python3.12 &> /dev/null; then
    PYTHON_CMD="python3.12"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
else
    echo "❌ Error: Python 3 is not installed"
    exit 1
fi

# Check if required packages are installed
echo "📦 Checking dependencies..."
$PYTHON_CMD -c "import psutil" 2>/dev/null || {
    echo "❌ Error: psutil is not installed. Installing..."
    pip3 install psutil
}

# Install requirements if needed
if [ -f "requirements.txt" ]; then
    echo "📦 Installing Python requirements..."
    pip3 install -r requirements.txt
fi

# Start the resource server
echo "🌐 Starting resource server on http://localhost:8005"
echo "📊 API will be accessible at: http://localhost:8005/api/data"
echo "🔄 Press Ctrl+C to stop the server"
echo ""

cd "$(dirname "$0")"
$PYTHON_CMD resource_server.py --host 0.0.0.0 --port 8005 