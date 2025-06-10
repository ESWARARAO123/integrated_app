import os
import sys
import fitz  # PyMuPDF

def extract_images_from_pdf(input_path, output_folder, min_size_kb=5, min_width=50, min_height=50):
    """
    Extracts images from PDF while filtering out small decorative elements.
    
    Args:
        input_path (str): Path to input PDF file
        output_folder (str): Output directory for images
        min_size_kb (int): Minimum file size in KB (default: 5KB)
        min_width (int): Minimum image width in pixels (default: 50px)
        min_height (int): Minimum image height in pixels (default: 50px)
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_folder, exist_ok=True)
    
    # Convert KB to bytes
    min_size_bytes = min_size_kb * 1024
    
    try:
        doc = fitz.open(input_path)
        image_count = 0
        skipped_count = 0
        
        print(f"\nProcessing PDF: {os.path.basename(input_path)}")
        print(f"Total pages: {len(doc)}")
        print(f"Filter settings: Min {min_size_kb}KB, Min {min_width}x{min_height}px")
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            image_list = page.get_images(full=True)
            
            if not image_list:
                continue
                
            print(f"\nPage {page_num+1}: Found {len(image_list)} images")
            
            for img_index, img in enumerate(image_list):
                xref = img[0]
                base_image = doc.extract_image(xref)
                
                if not base_image:
                    continue
                
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                width = base_image["width"]
                height = base_image["height"]
                
                # Skip conditions
                skip_reason = None
                if len(image_bytes) < min_size_bytes:
                    skip_reason = f"size ({len(image_bytes)/1024:.1f}KB < {min_size_kb}KB)"
                elif width < min_width or height < min_height:
                    skip_reason = f"dimensions ({width}x{height}px)"
                
                if skip_reason:
                    skipped_count += 1
                    print(f"  Skipping image {img_index+1} (small {skip_reason})")
                    continue
                
                # Save the image
                image_filename = f"image_page{page_num+1}_{img_index}.{image_ext}"
                image_path = os.path.join(output_folder, image_filename)
                
                with open(image_path, "wb") as img_file:
                    img_file.write(image_bytes)
                image_count += 1
                
                print(f"  Saved image {img_index+1}: {width}x{height}px, {len(image_bytes)/1024:.1f}KB")
        
        doc.close()
        
        print(f"\nExtraction complete!")
        print(f"  Images saved: {image_count}")
        print(f"  Images skipped (too small): {skipped_count}")
        print(f"  Output folder: {os.path.abspath(output_folder)}")
    
    except Exception as e:
        print(f"\nError: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("PDF Image Extractor with Size Filtering")
        print("-------------------------------------")
        print("Usage: python pdf_image_extractor.py <input.pdf> <output_folder> [min_size_kb] [min_width] [min_height]")
        print("Example (default): python pdf_image_extractor.py document.pdf images_output")
        print("Example (custom): python pdf_image_extractor.py doc.pdf output 10 100 100")
        sys.exit(1)
    
    input_pdf = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Optional parameters with defaults
    min_size_kb = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    min_width = int(sys.argv[4]) if len(sys.argv) > 4 else 50
    min_height = int(sys.argv[5]) if len(sys.argv) > 5 else 50
    
    extract_images_from_pdf(input_pdf, output_dir, min_size_kb, min_width, min_height)