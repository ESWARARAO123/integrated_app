#!/bin/bash
set -e

echo "🔧 Setting up PinnacleAi permissions for Docker containers..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/DATA"

echo "📁 Setting DATA directory permissions to 777 (universal access)..."
sudo chmod -R 777 "$DATA_DIR"

echo "✅ Permissions set successfully!"
echo ""
echo "🚀 You can now start the Docker containers:"
echo "   cd Docker && docker compose up -d"
echo ""
echo "🌐 Access the application at: http://localhost:5641" 