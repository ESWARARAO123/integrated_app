#!/usr/bin/env python3.9
"""
User Isolated Image Processor for RAG System
Extracts images from PDFs with OCR and maintains user isolation
"""

import os
import sys
import json
import base64
import uuid
from datetime import datetime
from pathlib import Path
import argparse
import traceback
import logging

# Set up logging - IMPORTANT: Use stderr to avoid interfering with JSON output on stdout
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr),  # Use stderr instead of stdout
        logging.FileHandler('/tmp/image_processor.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)

def check_dependencies():
    """Check if all required dependencies are available"""
    missing_deps = []
    
    try:
        import fitz  # PyMuPDF
        logger.info("✓ PyMuPDF (fitz) available")
    except ImportError:
        missing_deps.append("PyMuPDF")
        logger.error("✗ PyMuPDF (fitz) not available")
    
    try:
        import pytesseract
        logger.info("✓ pytesseract available")
    except ImportError:
        missing_deps.append("pytesseract")
        logger.error("✗ pytesseract not available")
    
    try:
        from PIL import Image
        logger.info("✓ PIL (Pillow) available")
    except ImportError:
        missing_deps.append("Pillow")
        logger.error("✗ PIL (Pillow) not available")
    
    if missing_deps:
        logger.error(f"Missing dependencies: {', '.join(missing_deps)}")
        return False, missing_deps
    
    return True, []

class UserIsolatedImageProcessor:
    """
    Image processor that maintains user isolation for RAG system
    """
    
    def __init__(self, base_data_dir="/app/data"):
        self.base_data_dir = Path(base_data_dir)
        self.collections_dir = self.base_data_dir / "collections"
        
        # Ensure directories exist
        self.collections_dir.mkdir(parents=True, exist_ok=True)
        
        # Check dependencies
        self.deps_available, self.missing_deps = check_dependencies()
        
        # OCR Configuration
        self.tesseract_config = '--oem 3 --psm 6'
        
        logger.info(f"Initialized processor with base_data_dir: {self.base_data_dir}")
        logger.info(f"Collections directory: {self.collections_dir}")
        logger.info(f"Dependencies available: {self.deps_available}")
        
        if not self.deps_available:
            logger.warning(f"Missing dependencies: {self.missing_deps}")
    
    def get_user_collection_dir(self, user_id):
        """Get or create user-specific collection directory"""
        # Sanitize user_id for filesystem
        safe_user_id = user_id.replace('-', '_').replace('/', '_').replace('\\', '_')
        user_dir = self.collections_dir / f"user_{safe_user_id}_images"
        user_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"User collection directory: {user_dir}")
        return user_dir
    
    def extract_images_from_pdf(self, pdf_path, user_id, session_id=None,
                               min_size_kb=5, min_width=100, min_height=100):
        """
        Extract images from PDF with user isolation
        """
        try:
            logger.info(f"Starting image extraction for user {user_id}, session {session_id}")
            logger.info(f"PDF path: {pdf_path}")
            logger.info(f"Filters: min_size_kb={min_size_kb}, min_width={min_width}, min_height={min_height}")
            
            if not self.deps_available:
                error_msg = f"Required dependencies not available: {self.missing_deps}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "missing_dependencies": self.missing_deps,
                    "images": []
                }
            
            # Import here after dependency check
            import fitz
            import pytesseract
            from PIL import Image
            
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
            
            # Create session-specific subdirectory
            if session_id:
                safe_session_id = session_id.replace('-', '_').replace('/', '_').replace('\\', '_')
                output_dir = user_dir / f"session_{safe_session_id}"
            else:
                output_dir = user_dir / "default"
            
            output_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Output directory: {output_dir}")
            
            # Open PDF
            doc = fitz.open(pdf_path)
            extracted_images = []
            total_images_found = 0
            images_processed = 0
            images_skipped = 0
            
            logger.info(f"PDF opened successfully. Total pages: {len(doc)}")
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                image_list = page.get_images(full=True)
                total_images_found += len(image_list)
                
                if not image_list:
                    logger.info(f"Page {page_num + 1}: No images found")
                    continue
                
                logger.info(f"Page {page_num + 1}: Found {len(image_list)} images")
                
                for img_index, img in enumerate(image_list):
                    try:
                        xref = img[0]
                        base_image = doc.extract_image(xref)
                        
                        if not base_image:
                            logger.warning(f"Page {page_num + 1}, Image {img_index}: Could not extract image")
                            continue
                        
                        image_bytes = base_image["image"]
                        image_ext = base_image["ext"]
                        width = base_image["width"]
                        height = base_image["height"]
                        size_kb = len(image_bytes) / 1024
                        
                        # Apply aggressive filtering for non-relevant images
                        skip_reason = None

                        # Skip very small images (likely logos, headers, decorative elements)
                        if size_kb < min_size_kb:
                            skip_reason = f"size {size_kb:.1f}KB < {min_size_kb}KB"

                        # Skip small dimensions (likely icons, bullets, decorative elements)
                        elif width < min_width or height < min_height:
                            skip_reason = f"dimensions {width}x{height}px too small"

                        # Skip very small images even if they meet KB threshold (1-3KB range)
                        elif size_kb <= 3.0:
                            skip_reason = f"size {size_kb:.1f}KB likely header/logo/decoration"

                        # Skip very thin or very wide images (likely headers, footers, lines)
                        elif width > height * 10 or height > width * 10:
                            skip_reason = f"aspect ratio {width}x{height}px likely decorative"

                        # Skip very small area images
                        elif (width * height) < 10000:  # Less than 100x100 equivalent
                            skip_reason = f"area {width*height}px too small for meaningful content"

                        if skip_reason:
                            logger.info(f"Page {page_num + 1}, Image {img_index}: Skipped ({skip_reason})")
                            images_skipped += 1
                            continue
                        
                        # Generate unique filename
                        image_id = str(uuid.uuid4())
                        image_filename = f"img_p{page_num+1}_i{img_index}_{image_id[:8]}.{image_ext}"
                        image_path = output_dir / image_filename
                        
                        # Save image file
                        with open(image_path, "wb") as img_file:
                            img_file.write(image_bytes)
                        
                        # Extract text using OCR
                        keywords = self.extract_image_text(image_path)
                        
                        # Convert to base64
                        base64_data = base64.b64encode(image_bytes).decode('utf-8')
                        
                        # Create image metadata
                        image_metadata = {
                            "image_id": image_id,
                            "user_id": user_id,
                            "session_id": session_id,
                            "filename": image_filename,
                            "page": page_num + 1,
                            "index": img_index,
                            "dimensions": f"{width}x{height}",
                            "size_kb": round(size_kb, 2),
                            "format": image_ext,
                            "base64": base64_data,
                            "keywords": keywords,
                            "timestamp": datetime.now().isoformat(),
                            "file_path": str(image_path)
                        }
                        
                        extracted_images.append(image_metadata)
                        images_processed += 1
                        
                        logger.info(f"✓ Page {page_num + 1}, Image {img_index}: Processed ({width}x{height}px, {size_kb:.1f}KB)")
                        
                    except Exception as e:
                        logger.error(f"✗ Page {page_num + 1}, Image {img_index}: Error - {str(e)}")
                        continue
            
            doc.close()
            
            # Save collection metadata
            collection_file = output_dir / "collection_metadata.json"
            collection_data = {
                "user_id": user_id,
                "session_id": session_id,
                "pdf_source": str(pdf_path),
                "total_images_found": total_images_found,
                "images_processed": images_processed,
                "images_skipped": images_skipped,
                "created_at": datetime.now().isoformat(),
                "filters": {
                    "min_size_kb": min_size_kb,
                    "min_width": min_width,
                    "min_height": min_height
                },
                "images": extracted_images
            }
            
            with open(collection_file, 'w', encoding='utf-8') as f:
                json.dump(collection_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"✅ Extraction complete!")
            logger.info(f"   Total images found: {total_images_found}")
            logger.info(f"   Images processed: {images_processed}")
            logger.info(f"   Images skipped: {images_skipped}")
            logger.info(f"   Collection saved: {collection_file}")
            
            return {
                "success": True,
                "user_id": user_id,
                "session_id": session_id,
                "images": extracted_images,
                "collection_path": str(collection_file),
                "stats": {
                    "total_found": total_images_found,
                    "processed": images_processed,
                    "skipped": images_skipped
                }
            }
            
        except Exception as e:
            error_msg = f"Error processing PDF: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
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
            import pytesseract
            from PIL import Image
            
            with Image.open(image_path) as img:
                # Try OCR
                text = pytesseract.image_to_string(img, config=self.tesseract_config)
                text = " ".join(text.split())  # Clean whitespace
                
                if text and len(text.strip()) > 3:
                    logger.info(f"OCR extracted text from {Path(image_path).name}: {text[:50]}...")
                    return text.strip()
        
        except Exception as e:
            logger.warning(f"OCR failed for {Path(image_path).name}: {e}")
        
        # Fallback to contextual keywords
        fallback = self.generate_fallback_keywords(Path(image_path).name)
        logger.info(f"Using fallback keywords for {Path(image_path).name}: {fallback}")
        return fallback
    
    def generate_fallback_keywords(self, filename):
        """
        Generate contextual keywords when OCR fails
        """
        keywords = []
        
        # Extract page and position info
        if 'img_p' in filename:
            parts = filename.split('_')
            if len(parts) >= 3:
                page_part = parts[1]  # p1, p2, etc.
                index_part = parts[2]  # i0, i1, etc.
                
                if page_part.startswith('p'):
                    page_num = page_part[1:]
                    keywords.append(f"Page {page_num}")
                
                if index_part.startswith('i'):
                    img_index = int(index_part[1:])
                    if img_index == 0:
                        keywords.append("First image on page")
                    elif img_index > 2:
                        keywords.append("Later image on page")
                    else:
                        keywords.append("Image on page")
        
        # Add generic content type
        keywords.extend(["Figure", "Illustration", "Visual content", "Document image"])
        
        return ", ".join(keywords)


def main():
    """
    Main function for command-line usage
    """
    parser = argparse.ArgumentParser(description="User-Isolated Image Processing for RAG System")
    parser.add_argument("pdf_path", help="Path to PDF file")
    parser.add_argument("user_id", help="User ID for isolation")
    parser.add_argument("--session-id", help="Optional session ID")
    parser.add_argument("--min-size-kb", type=int, default=5, help="Minimum image size in KB (filters out logos/headers)")
    parser.add_argument("--min-width", type=int, default=100, help="Minimum image width in pixels")
    parser.add_argument("--min-height", type=int, default=100, help="Minimum image height in pixels")
    parser.add_argument("--data-dir", default="/app/data", help="Base data directory")
    
    if len(sys.argv) < 3:
        parser.print_help()
        sys.exit(1)
    
    args = parser.parse_args()
    
    logger.info("=== Starting User Isolated Image Processor ===")
    logger.info(f"Arguments: {vars(args)}")
    
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
    # IMPORTANT: Only JSON should go to stdout, all logging goes to stderr
    try:
        json_output = json.dumps(result, indent=2)
        print(json_output)  # This goes to stdout
        sys.stdout.flush()  # Ensure it's written immediately
    except Exception as e:
        # If JSON serialization fails, output a simple error JSON
        error_result = {
            "success": False,
            "error": f"JSON serialization failed: {str(e)}",
            "images": []
        }
        print(json.dumps(error_result))

    # Exit with appropriate code
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
