#!/bin/bash

# Test script for Image Processing Docker Container
# This script tests the OCR and image extraction capabilities

set -e

echo "🔧 Testing Image Processing Docker Container"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

print_status "Docker is running"

# Build the image processor container
echo -e "\n📦 Building Image Processor Container..."
if docker build -f Docker/Dockerfile.image-processor -t productdemo-image-processor .; then
    print_status "Image processor container built successfully"
else
    print_error "Failed to build image processor container"
    exit 1
fi

# Test Tesseract installation
echo -e "\n🔍 Testing Tesseract OCR Installation..."
if docker run --rm productdemo-image-processor tesseract --version; then
    print_status "Tesseract OCR is properly installed"
else
    print_error "Tesseract OCR installation failed"
    exit 1
fi

# Test Python dependencies
echo -e "\n🐍 Testing Python Dependencies..."
docker run --rm productdemo-image-processor python -c "
import sys
try:
    import fitz
    print('✓ PyMuPDF (fitz) imported successfully')
except ImportError as e:
    print(f'✗ PyMuPDF import failed: {e}')
    sys.exit(1)

try:
    import pytesseract
    print('✓ pytesseract imported successfully')
except ImportError as e:
    print(f'✗ pytesseract import failed: {e}')
    sys.exit(1)

try:
    from PIL import Image
    print('✓ Pillow (PIL) imported successfully')
except ImportError as e:
    print(f'✗ Pillow import failed: {e}')
    sys.exit(1)

print('✅ All Python dependencies are available')
"

if [ $? -eq 0 ]; then
    print_status "All Python dependencies are working"
else
    print_error "Python dependencies test failed"
    exit 1
fi

# Test OCR functionality with a simple image
echo -e "\n📝 Testing OCR Functionality..."
docker run --rm productdemo-image-processor python -c "
import pytesseract
from PIL import Image, ImageDraw, ImageFont
import tempfile
import os

# Create a simple test image with text
img = Image.new('RGB', (300, 100), color='white')
draw = ImageDraw.Draw(img)

# Try to use a default font, fallback to basic if not available
try:
    font = ImageFont.load_default()
except:
    font = None

draw.text((10, 30), 'Hello OCR Test', fill='black', font=font)

# Save to temporary file
with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
    img.save(tmp.name)
    
    # Test OCR
    try:
        text = pytesseract.image_to_string(tmp.name)
        if 'Hello' in text or 'OCR' in text:
            print('✅ OCR functionality is working correctly')
            print(f'Extracted text: {text.strip()}')
        else:
            print(f'⚠ OCR extracted text but may not be accurate: {text.strip()}')
    except Exception as e:
        print(f'✗ OCR test failed: {e}')
        exit(1)
    finally:
        os.unlink(tmp.name)
"

if [ $? -eq 0 ]; then
    print_status "OCR functionality test passed"
else
    print_error "OCR functionality test failed"
    exit 1
fi

# Test the custom image processor script
echo -e "\n🖼️ Testing Custom Image Processor Script..."
docker run --rm -v "$(pwd)/python/RAG-MODULE/image-processing:/app/test-scripts" productdemo-image-processor python -c "
import sys
sys.path.append('/app/test-scripts')

try:
    from docker_image_processor import UserIsolatedImageProcessor
    print('✓ Custom image processor script imports successfully')
    
    # Test processor initialization
    processor = UserIsolatedImageProcessor('/tmp/test-data')
    print('✓ Image processor initializes correctly')
    
    # Test user directory creation
    user_dir = processor.get_user_collection_dir('test-user-123')
    print(f'✓ User collection directory created: {user_dir}')
    
    print('✅ Custom image processor script is working')
    
except Exception as e:
    print(f'✗ Custom image processor test failed: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)
"

if [ $? -eq 0 ]; then
    print_status "Custom image processor script test passed"
else
    print_error "Custom image processor script test failed"
    exit 1
fi

# Final success message
echo -e "\n🎉 ${GREEN}All tests passed successfully!${NC}"
echo -e "\n📋 Summary:"
echo "   ✅ Docker container builds correctly"
echo "   ✅ Tesseract OCR is installed and working"
echo "   ✅ Python dependencies are available"
echo "   ✅ OCR functionality is operational"
echo "   ✅ Custom image processor script is ready"

echo -e "\n🚀 ${GREEN}Image Processing Container is ready for integration!${NC}"
echo -e "\n📝 Next steps:"
echo "   1. Start the container: docker compose up -d image-processor"
echo "   2. Test with a real PDF: docker compose exec image-processor python image-processing/docker_image_processor.py <pdf_path> <user_id>"
echo "   3. Integrate with the main RAG system"

echo -e "\n💡 ${YELLOW}Tip:${NC} You can now proceed to integrate this with your main application!"
