import os
import subprocess
import sys

def run_script(script_name, *args):
    """Run a Python script with given arguments"""
    print(f"\n{'='*50}")
    print(f"Running {script_name}...")
    print(f"{'='*50}")
    
    try:
        python_exe = os.path.join("venv", "Scripts", "python.exe")
        cmd = [python_exe, script_name] + list(args)
        subprocess.run(cmd, check=True)
        print(f"\n✓ Successfully completed {script_name}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n✗ Error running {script_name}: {str(e)}")
        return False

def main():
    # Define input/output directories
    input_pdf = "input.pdf"
    output_folder = "output_folder"
    base64_output = os.path.join(output_folder, "image_data.csv")
    final_output = "base64toimage"
    
    # Create output directories if they don't exist
    os.makedirs(output_folder, exist_ok=True)
    os.makedirs(final_output, exist_ok=True)
    
    # 1. Extract images from PDF
    if not run_script("pdf_image_extractor.py", input_pdf, output_folder):
        print("Failed to extract images from PDF. Pipeline stopped.")
        return
    
    # 2. Convert images to base64
    if not run_script("image_to_base64.py", output_folder):
        print("Failed to convert images to base64. Pipeline stopped.")
        return
    # 3. Convert base64 back to images
    if not run_script("mian.py", base64_output):
        print("Failed to convert base64 back to images. Pipeline stopped.")
        return
    
    print("\nPipeline completed successfully!")
    print(f"1. Images extracted from PDF to: {output_folder}")
    print(f"2. Base64 data saved to: {base64_output}")
    print(f"3. Final images reconstructed in: {final_output}")

if __name__ == "__main__":
    main()
