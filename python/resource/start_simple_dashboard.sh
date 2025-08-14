#!/bin/bash

# Database Table Viewer Startup Script

echo "🚀 Starting Database Table Viewer..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed or not in PATH"
    exit 1
fi

# Check if required packages are installed
echo "📦 Checking dependencies..."
python3 -c "import psycopg2" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 Installing required packages..."
    pip3 install psycopg2-binary==2.9.9
fi

# Start the dashboard
echo "🌐 Starting Database Table Viewer on http://localhost:8005"
echo "🗄️  Connecting to database: 172.16.16.21:5432/demo"
python3 web_dashboard.py --port 8005 --host localhost 