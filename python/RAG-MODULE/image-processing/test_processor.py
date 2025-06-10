#!/usr/bin/env python3.9
"""
Test script for the User Isolated Image Processor
"""

import sys
import json
from pathlib import Path
from user_isolated_image_processor import UserIsolatedImageProcessor, check_dependencies

def test_dependencies():
    """Test if all dependencies are available"""
    print("🔧 Testing Dependencies...")
    print("=" * 50)
    
    deps_available, missing_deps = check_dependencies()
    
    if deps_available:
        print("✅ All dependencies are available!")
        return True
    else:
        print(f"❌ Missing dependencies: {missing_deps}")
        return False

def test_processor_initialization():
    """Test processor initialization"""
    print("\n🏗️ Testing Processor Initialization...")
    print("=" * 50)
    
    try:
        processor = UserIsolatedImageProcessor("/tmp/test_data")
        print("✅ Processor initialized successfully!")
        print(f"   Base data dir: {processor.base_data_dir}")
        print(f"   Collections dir: {processor.collections_dir}")
        print(f"   Dependencies available: {processor.deps_available}")
        return processor
    except Exception as e:
        print(f"❌ Processor initialization failed: {e}")
        return None

def test_user_directory_creation(processor):
    """Test user directory creation"""
    print("\n📁 Testing User Directory Creation...")
    print("=" * 50)
    
    try:
        test_user_id = "test-user-123-456"
        user_dir = processor.get_user_collection_dir(test_user_id)
        
        if user_dir.exists():
            print(f"✅ User directory created: {user_dir}")
            return True
        else:
            print(f"❌ User directory not created: {user_dir}")
            return False
    except Exception as e:
        print(f"❌ User directory creation failed: {e}")
        return False

def test_pdf_processing(processor, pdf_path):
    """Test PDF processing"""
    print("\n📄 Testing PDF Processing...")
    print("=" * 50)
    
    if not Path(pdf_path).exists():
        print(f"❌ PDF file not found: {pdf_path}")
        return False
    
    try:
        result = processor.extract_images_from_pdf(
            pdf_path=pdf_path,
            user_id="test-user-123",
            session_id="test-session-456",
            min_size_kb=1,  # Lower threshold for testing
            min_width=10,   # Lower threshold for testing
            min_height=10   # Lower threshold for testing
        )
        
        print(f"Processing result: {result['success']}")
        
        if result["success"]:
            stats = result.get("stats", {})
            print(f"✅ PDF processed successfully!")
            print(f"   Total images found: {stats.get('total_found', 0)}")
            print(f"   Images processed: {stats.get('processed', 0)}")
            print(f"   Images skipped: {stats.get('skipped', 0)}")
            print(f"   Collection path: {result.get('collection_path', 'N/A')}")
            
            # Show first few images
            images = result.get("images", [])
            if images:
                print(f"\n📸 Sample Images:")
                for i, img in enumerate(images[:3]):  # Show first 3
                    print(f"   Image {i+1}:")
                    print(f"     - Filename: {img['filename']}")
                    print(f"     - Page: {img['page']}")
                    print(f"     - Dimensions: {img['dimensions']}")
                    print(f"     - Size: {img['size_kb']}KB")
                    print(f"     - Keywords: {img['keywords'][:100]}...")
                    print(f"     - Base64 length: {len(img['base64'])} chars")
            
            return True
        else:
            print(f"❌ PDF processing failed: {result.get('error', 'Unknown error')}")
            if 'missing_dependencies' in result:
                print(f"   Missing dependencies: {result['missing_dependencies']}")
            return False
            
    except Exception as e:
        print(f"❌ PDF processing exception: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 User Isolated Image Processor Test Suite")
    print("=" * 60)
    
    # Test 1: Dependencies
    if not test_dependencies():
        print("\n❌ Dependency test failed. Cannot continue.")
        sys.exit(1)
    
    # Test 2: Processor initialization
    processor = test_processor_initialization()
    if not processor:
        print("\n❌ Processor initialization failed. Cannot continue.")
        sys.exit(1)
    
    # Test 3: User directory creation
    if not test_user_directory_creation(processor):
        print("\n❌ User directory creation failed.")
        sys.exit(1)
    
    # Test 4: PDF processing (if input.pdf exists)
    pdf_path = "/app/image-processing/input.pdf"
    if Path(pdf_path).exists():
        if test_pdf_processing(processor, pdf_path):
            print("\n✅ All tests passed!")
        else:
            print("\n❌ PDF processing test failed.")
            sys.exit(1)
    else:
        print(f"\n⚠️ PDF file not found at {pdf_path}, skipping PDF processing test")
        print("✅ Basic tests passed!")
    
    print("\n🎉 Test suite completed successfully!")

if __name__ == "__main__":
    main()
