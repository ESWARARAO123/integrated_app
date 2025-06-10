#!/usr/bin/env python3.9
"""
Docker-optimized Image Processing Pipeline for RAG System
Supports user isolation and integrates with existing queue system
"""

import os
import sys
import json
import base64
import csv
import re
import uuid
from datetime import datetime
from pathlib import Path
import argparse
import traceback
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import required libraries
try:
    import fitz  # PyMuPDF
    logger.info("PyMuPDF (fitz) imported successfully")
except ImportError as e:
    logger.error(f"PyMuPDF import failed: {e}")
    fitz = None

try:
    import pytesseract
    logger.info("pytesseract imported successfully")
except ImportError as e:
    logger.error(f"pytesseract import failed: {e}")
    pytesseract = None

try:
    from PIL import Image
    logger.info("PIL (Pillow) imported successfully")
except ImportError as e:
    logger.error(f"PIL import failed: {e}")
    Image = None

DEPENDENCIES_AVAILABLE = all([fitz, pytesseract, Image])

class UserIsolatedImageProcessor:
    """
    Image processor that maintains user isolation for RAG system
    """

    def __init__(self, base_data_dir="/app/data"):
        self.base_data_dir = Path(base_data_dir)
        self.collections_dir = self.base_data_dir / "collections"

        # Ensure directories exist
        self.collections_dir.mkdir(parents=True, exist_ok=True)

        # OCR Configuration
        self.tesseract_config = '--oem 3 --psm 6'  # Optimized for document images

        logger.info(f"Initialized UserIsolatedImageProcessor with base_data_dir: {self.base_data_dir}")
        logger.info(f"Collections directory: {self.collections_dir}")
        logger.info(f"Dependencies available: {DEPENDENCIES_AVAILABLE}")
        
    def get_user_collection_dir(self, user_id):
        """Get or create user-specific collection directory"""
        user_dir = self.collections_dir / f"user_{user_id.replace('-', '_')}_images"
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir
    
    def extract_images_from_pdf(self, pdf_path, user_id, session_id=None,
                               min_size_kb=5, min_width=50, min_height=50):
        """
        Extract images from PDF with user isolation
        """
        try:
            logger.info(f"Starting image extraction for user {user_id}, session {session_id}")
            logger.info(f"PDF path: {pdf_path}")

            if not DEPENDENCIES_AVAILABLE:
                error_msg = "Required dependencies not available"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "images": []
                }

            # Check if PDF file exists
            if not os.path.exists(pdf_path):
                error_msg = f"PDF file not found: {pdf_path}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "images": []
                }

            # Get user collection directory
            user_dir = self.get_user_collection_dir(user_id)

            # Create session-specific subdirectory if session_id provided
            if session_id:
                output_dir = user_dir / f"session_{session_id}"
            else:
                output_dir = user_dir / "default"

            output_dir.mkdir(parents=True, exist_ok=True)

            logger.info(f"Processing PDF for user {user_id}: {Path(pdf_path).name}")
            logger.info(f"Output directory: {output_dir}")

            doc = fitz.open(pdf_path)
            extracted_images = []
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                image_list = page.get_images(full=True)
                
                for img_index, img in enumerate(image_list):
                    try:
                        xref = img[0]
                        base_image = doc.extract_image(xref)
                        
                        if not base_image:
                            continue
                        
                        image_bytes = base_image["image"]
                        image_ext = base_image["ext"]
                        width = base_image["width"]
                        height = base_image["height"]
                        
                        # Apply size filters
                        if (len(image_bytes) < min_size_kb * 1024 or 
                            width < min_width or height < min_height):
                            continue
                        
                        # Generate unique filename
                        image_id = str(uuid.uuid4())
                        image_filename = f"img_{page_num+1}_{img_index}_{image_id}.{image_ext}"
                        image_path = output_dir / image_filename
                        
                        # Save image
                        with open(image_path, "wb") as img_file:
                            img_file.write(image_bytes)
                        
                        # Extract text using OCR
                        keywords = self.extract_image_text(image_path)
                        
                        # Convert to base64
                        base64_data = base64.b64encode(image_bytes).decode('utf-8')
                        
                        # Store image metadata
                        image_metadata = {
                            "image_id": image_id,
                            "user_id": user_id,
                            "session_id": session_id,
                            "filename": image_filename,
                            "page": page_num + 1,
                            "index": img_index,
                            "dimensions": f"{width}x{height}",
                            "size_kb": round(len(image_bytes) / 1024, 2),
                            "format": image_ext,
                            "base64": base64_data,
                            "keywords": keywords,
                            "timestamp": datetime.now().isoformat(),
                            "file_path": str(image_path)
                        }
                        
                        extracted_images.append(image_metadata)
                        
                        print(f"  ✓ Extracted: Page {page_num+1}, Image {img_index} ({width}x{height})")
                        
                    except Exception as e:
                        print(f"  ✗ Error extracting image {img_index} from page {page_num+1}: {e}")
                        continue
            
            doc.close()
            
            # Save collection metadata
            collection_file = output_dir / "collection_metadata.json"
            collection_data = {
                "user_id": user_id,
                "session_id": session_id,
                "pdf_source": str(pdf_path),
                "total_images": len(extracted_images),
                "created_at": datetime.now().isoformat(),
                "images": extracted_images
            }
            
            with open(collection_file, 'w', encoding='utf-8') as f:
                json.dump(collection_data, f, indent=2, ensure_ascii=False)
            
            print(f"\n✅ Extraction complete: {len(extracted_images)} images processed")
            print(f"Collection saved to: {collection_file}")
            
            return {
                "success": True,
                "user_id": user_id,
                "session_id": session_id,
                "images": extracted_images,
                "collection_path": str(collection_file),
                "total_count": len(extracted_images)
            }
            
        except Exception as e:
            error_msg = f"Error processing PDF: {str(e)}"
            print(f"❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "traceback": traceback.format_exc(),
                "images": []
            }
    
    def extract_image_text(self, image_path):
        """
        Extract text from image using OCR with fallback keywords
        """
        try:
            # Try OCR first
            with Image.open(image_path) as img:
                text = pytesseract.image_to_string(img, config=self.tesseract_config)
                text = " ".join(text.split())  # Clean whitespace
                
                if text and len(text.strip()) > 3:
                    return text.strip()
        
        except Exception as e:
            print(f"    ⚠ OCR failed for {Path(image_path).name}: {e}")
        
        # Fallback to contextual keywords
        return self.generate_fallback_keywords(Path(image_path).name)
    
    def generate_fallback_keywords(self, filename):
        """
        Generate contextual keywords when OCR fails
        """
        # Extract page and position info
        match = re.search(r'img_(\d+)_(\d+)', filename)
        if match:
            page_num = int(match.group(1))
            img_index = int(match.group(2))
            
            keywords = [f"Page {page_num}"]
            
            # Add position context
            if img_index == 0:
                keywords.append("Top of page")
            elif img_index > 2:
                keywords.append("Bottom of page")
            else:
                keywords.append("Middle of page")
            
            # Add content type hints
            keywords.extend(["Figure", "Illustration", "Visual content"])
            
            return ", ".join(keywords)
        
        return "Image content, visual element"


def main():
    """
    Main function for command-line usage
    """
    parser = argparse.ArgumentParser(description="User-Isolated Image Processing for RAG System")
    parser.add_argument("pdf_path", help="Path to PDF file")
    parser.add_argument("user_id", help="User ID for isolation")
    parser.add_argument("--session-id", help="Optional session ID")
    parser.add_argument("--min-size-kb", type=int, default=5, help="Minimum image size in KB")
    parser.add_argument("--min-width", type=int, default=50, help="Minimum image width")
    parser.add_argument("--min-height", type=int, default=50, help="Minimum image height")
    parser.add_argument("--data-dir", default="/app/data", help="Base data directory")
    
    if len(sys.argv) < 3:
        parser.print_help()
        sys.exit(1)
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = UserIsolatedImageProcessor(args.data_dir)
    
    # Process PDF
    result = processor.extract_images_from_pdf(
        pdf_path=args.pdf_path,
        user_id=args.user_id,
        session_id=args.session_id,
        min_size_kb=args.min_size_kb,
        min_width=args.min_width,
        min_height=args.min_height
    )
    
    # Output result as JSON for integration with Node.js
    print(json.dumps(result, indent=2))
    
    # Exit with appropriate code
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
