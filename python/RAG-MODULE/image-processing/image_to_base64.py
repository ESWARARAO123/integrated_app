import os
import base64
import csv
import re
from PIL import Image
from datetime import datetime
import sys

# Try to import pytesseract, but continue if it's not available
try:
    import pytesseract
    # Set the path to tesseract executable
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    print("Warning: pytesseract not available. OCR functionality will be disabled.")

# Function to extract page number and image index from filename
def extract_page_info(filename):
    match = re.search(r'page(\d+)_(\d+)', filename)
    if match:
        page_num = int(match.group(1))
        img_index = int(match.group(2))
        return page_num, img_index
    return None, None

# Function to generate fallback keywords based on image context
def generate_fallback_keywords(filename):
    page_num, img_index = extract_page_info(filename)
    if page_num is not None:
        # Create contextual keywords based on page number and position
        keywords = []
        
        # Add page information
        keywords.append(f"Page {page_num}")
        
        # Add position context
        if img_index == 0:
            keywords.append("Top of page")
        elif img_index > 2:
            keywords.append("Bottom of page")
        else:
            keywords.append("Middle of page")
            
        # Add potential content type based on filename
        if "chart" in filename.lower() or "graph" in filename.lower():
            keywords.append("Chart/Graph")
        elif "table" in filename.lower():
            keywords.append("Table")
        elif "diagram" in filename.lower():
            keywords.append("Diagram")
        elif "screenshot" in filename.lower():
            keywords.append("Screenshot")
        else:
            keywords.append("Figure/Illustration")
            
        return ", ".join(keywords)
    
    # If we can't extract page info, return a generic fallback
    return "Image content, no text detected"

def images_to_base64_csv(output_folder, csv_filename="image_data.csv"):
    """
    Converts images to Base64 and stores metadata in CSV
    
    Args:
        output_folder (str): Folder containing extracted images
        csv_filename (str): Name of output CSV file
    """
    print(f"\nStarting image to Base64 conversion...")
    print(f"Output folder: {output_folder}")
    print(f"CSV filename: {csv_filename}")
    
    # Create CSV file in the output folder
    csv_path = os.path.join(output_folder, csv_filename)
    print(f"CSV path: {csv_path}")
    
    try:
        # Get all image files from the folder
        image_files = []
        valid_extensions = ('.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff')
        
        print(f"Looking for image files in: {output_folder}")
        all_files = os.listdir(output_folder)
        print(f"Found {len(all_files)} files in the folder")
        
        for f in all_files:
            if f.lower().endswith(valid_extensions):
                image_files.append(f)
        
        if not image_files:
            print("\nError: No image files found in the output folder")
            print(f"Supported formats: {', '.join(valid_extensions)}")
            return False
        
        print(f"Found {len(image_files)} image files to process")
        
        with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'filename', 
                'file_size_kb', 
                'dimensions', 
                'format', 
                'base64_data',
                'timestamp',
                'keywords'  # New field for extracted text
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            processed_count = 0
            error_count = 0
            
            for img_file in image_files:
                img_path = os.path.join(output_folder, img_file)
                
                try:
                    # Get image metadata
                    with Image.open(img_path) as img:
                        width, height = img.size
                        img_format = img.format or os.path.splitext(img_file)[1][1:].upper()
                        
                        # Extract text from image using OCR if available
                        text = ""
                        if TESSERACT_AVAILABLE:
                            try:
                                text = pytesseract.image_to_string(img)
                                # Clean up the extracted text
                                text = " ".join(text.split())  # Remove extra whitespace
                            except Exception as ocr_error:
                                print(f"    ⚠ OCR Warning for {img_file}: {str(ocr_error)}")
                                text = ""
                        
                        # If OCR failed or is not available, use fallback keywords
                        if not text or text.strip() == "":
                            text = generate_fallback_keywords(img_file)
                            print(f"    ℹ Using fallback keywords for {img_file}: {text}")
                    
                    # Get file size
                    file_size = os.path.getsize(img_path)
                    file_size_kb = round(file_size / 1024, 2)
                    
                    # Convert to Base64
                    with open(img_path, 'rb') as image_file:
                        base64_data = base64.b64encode(image_file.read()).decode('utf-8')
                    
                    # Write to CSV
                    writer.writerow({
                        'filename': img_file,
                        'file_size_kb': file_size_kb,
                        'dimensions': f"{width}x{height}",
                        'format': img_format,
                        'base64_data': base64_data,
                        'timestamp': datetime.now().isoformat(),
                        'keywords': text  # Add the extracted text
                    })
                    
                    processed_count += 1
                    print(f"  ✓ Processed: {img_file} ({width}x{height}, {file_size_kb}KB)")
                    
                except Exception as e:
                    error_count += 1
                    print(f"  ✗ Error processing {img_file}: {str(e)}")
                    continue
            
            print(f"\nConversion complete!")
            print(f"  Successfully processed: {processed_count} images")
            print(f"  Failed to process: {error_count} images")
            print(f"  CSV file created at: {csv_path}")
            
            return True
    
    except Exception as e:
        print(f"\nFatal error during conversion: {str(e)}")
        return False

if __name__ == "__main__":
    print("Image to Base64 CSV Converter")
    print("----------------------------")
    print(f"Arguments: {sys.argv}")
    
    if len(sys.argv) < 2:
        print("\nUsage: python image_to_base64.py <output_folder> [csv_filename]")
        print("Example: python image_to_base64.py images_output image_data.csv")
        print("\nNote: The output folder should contain images extracted from the PDF")
        sys.exit(1)
    
    output_folder = sys.argv[1]
    csv_filename = sys.argv[2] if len(sys.argv) > 2 else "image_data.csv"
    
    # Normalize path and check existence
    output_folder = os.path.normpath(output_folder)
    if not os.path.exists(output_folder):
        print(f"\nError: Folder '{output_folder}' does not exist")
        print("Please provide the correct path to the folder containing extracted images")
        sys.exit(1)
    
    if not os.path.isdir(output_folder):
        print(f"\nError: '{output_folder}' is not a directory")
        sys.exit(1)
    
    success = images_to_base64_csv(output_folder, csv_filename)
    
    if not success:
        sys.exit(1)