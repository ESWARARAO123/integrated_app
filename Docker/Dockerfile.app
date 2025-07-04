FROM node:20-slim

# Install Python 3.11 and required dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-pip \
    python3-dev \
    build-essential \
    curl \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create symbolic links for python3
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy Python requirements and RAG module
COPY python/requirements.txt ./python/requirements.txt
COPY python/RAG-MODULE/ ./python/RAG-MODULE/

# Setup Python virtual environment for main app
RUN python3 -m venv /app/python/venv
ENV PATH="/app/python/venv/bin:$PATH"

# Install main Python requirements
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r python/requirements.txt

# Install additional RAG module requirements in the same venv
RUN pip install --no-cache-dir pdfplumber==0.9.0 Pillow>=9.0.0 Wand>=0.6.7 cryptography>=38.0.0

# Make Python scripts executable
RUN chmod +x python/RAG-MODULE/installvenv.sh

# Create the extract scripts if they don't exist (without running the full installvenv.sh)
RUN cd python/RAG-MODULE && \
    if [ ! -f "extract_text.py" ]; then \
        echo "Creating extract_text.py..."; \
        cat > extract_text.py << 'EOL'
#!/usr/bin/env python3

import sys
import json
import argparse
import traceback

def extract_text_with_pdfplumber(pdf_path):
    try:
        try:
            import pdfplumber
        except ImportError:
            return {
                "success": False,
                "error": "pdfplumber module not installed. Install with: pip install pdfplumber",
                "instructions": "Run: pip install --user pdfplumber"
            }
        
        full_text = ""
        page_texts = []
        
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            
            for i, page in enumerate(pdf.pages):
                page_num = i + 1
                page_text = page.extract_text()
                
                if page_text:
                    marked_text = f"\n\n[Page {page_num} of {total_pages}]\n{page_text}"
                    full_text += marked_text
                    page_texts.append({
                        "page_num": page_num,
                        "text": page_text
                    })
        
        return {
            "success": True,
            "text": full_text.strip(),
            "page_count": total_pages,
            "pages": page_texts
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

def process_pdf(pdf_path):
    if not pdf_path or not pdf_path.lower().endswith('.pdf'):
        return {
            "success": False,
            "error": f"Invalid PDF file: {pdf_path}"
        }
    
    try:
        with open(pdf_path, 'rb') as f:
            pass
    except Exception as e:
        return {
            "success": False,
            "error": f"Could not access PDF file: {str(e)}"
        }
    
    return extract_text_with_pdfplumber(pdf_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract text from PDF using pdfplumber")
    parser.add_argument("pdf_path", help="Path to the PDF file")
    
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "PDF path argument is required"
        }))
        sys.exit(1)
    
    args = parser.parse_args()
    result = process_pdf(args.pdf_path)
    print(json.dumps(result))
EOL
        chmod +x extract_text.py; \
    fi

# Copy the rest of the application
COPY . .

# Build client application
WORKDIR /app/client
RUN npm install && npm run build

# Back to app root
WORKDIR /app

# Make entrypoint script executable
RUN chmod +x Docker/docker-entrypoint.sh

# Expose port
EXPOSE 5640

# Set entrypoint
ENTRYPOINT ["./Docker/docker-entrypoint.sh"]

# Command to run the application
CMD ["npm", "start"]