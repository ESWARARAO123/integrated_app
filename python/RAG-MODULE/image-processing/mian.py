import csv
import base64
import os
import sys

def base64_to_images(csv_file):
    """Converts Base64 data from CSV back to images"""
    print(f"\nStarting Base64 to image conversion...")
    
    output_folder = "base64toimage"
    
    try:
        if not os.path.exists(csv_file):
            print(f"Error: CSV file '{csv_file}' not found")
            return False
        
        # Create output folder if it doesn't exist
        os.makedirs(output_folder, exist_ok=True)
        
        with open(csv_file, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            success_count = 0
            error_count = 0
            
            for row in reader:
                try:
                    # Get filename and Base64 data from CSV
                    filename = row['filename']
                    base64_data = row['base64_data']
                    
                    # Define output path
                    output_path = os.path.join(output_folder, filename)
                    
                    # Write decoded data to image file
                    with open(output_path, 'wb') as img_file:
                        img_file.write(base64.b64decode(base64_data))
                    
                    success_count += 1
                    print(f"  ✓ Reconstructed: {filename}")
                
                except Exception as e:
                    error_count += 1
                    print(f"  ✗ Error reconstructing {row.get('filename', 'unknown')}: {str(e)}")
                    continue
            
            print(f"\nConversion complete!")
            print(f"  Successfully reconstructed: {success_count} images")
            print(f"  Failed to reconstruct: {error_count} images")
            print(f"  Output folder: {os.path.abspath(output_folder)}")
            
            return True
    
    except Exception as e:
        print(f"\nFatal error during reconstruction: {str(e)}")
        return False

if __name__ == "__main__":
    print("Base64 to Image Converter")
    print("------------------------")
    
    if len(sys.argv) < 2:
        print("\nUsage: python base64_to_images.py <input.csv>")
        print("Example: python base64_to_images.py output_folder/image_data.csv")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    
    success = base64_to_images(csv_file)
    
    if not success:
        sys.exit(1)