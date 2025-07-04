#!/usr/bin/env python3
"""
HTTP API Server for Image Processing Service
Provides REST endpoints for processing images from PDFs in a containerized environment
"""

import os
import sys
import json
import logging
import traceback
from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

# Add the current directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent))

from user_isolated_image_processor import UserIsolatedImageProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Image Processing API",
    description="REST API for extracting and processing images from PDF documents",
    version="1.0.0"
)

# Global processor instance
processor = None

class ProcessImageRequest(BaseModel):
    """Request model for image processing"""
    pdf_path: str
    user_id: str
    session_id: Optional[str] = None
    min_size_kb: Optional[int] = 5
    min_width: Optional[int] = 100
    min_height: Optional[int] = 100

class ProcessImageResponse(BaseModel):
    """Response model for image processing"""
    success: bool
    message: str
    total_count: int = 0
    images: list = []
    stats: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@app.on_event("startup")
async def startup_event():
    """Initialize the image processor on startup"""
    global processor
    try:
        # Initialize with default data directory
        data_dir = os.environ.get('IMAGE_PROCESSOR_DATA_DIR', '/app/data')
        processor = UserIsolatedImageProcessor(data_dir)
        logger.info(f"Image processor initialized with data directory: {data_dir}")
        logger.info(f"Dependencies available: {processor.deps_available}")
        if not processor.deps_available:
            logger.warning(f"Missing dependencies: {processor.missing_deps}")
    except Exception as e:
        logger.error(f"Failed to initialize image processor: {e}")
        logger.error(traceback.format_exc())

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    global processor
    if processor is None:
        raise HTTPException(status_code=503, detail="Image processor not initialized")
    
    return {
        "status": "healthy",
        "dependencies_available": processor.deps_available,
        "missing_dependencies": processor.missing_deps if not processor.deps_available else []
    }

@app.post("/process", response_model=ProcessImageResponse)
async def process_images(request: ProcessImageRequest):
    """Process images from a PDF document"""
    global processor
    
    if processor is None:
        raise HTTPException(status_code=503, detail="Image processor not initialized")
    
    try:
        logger.info(f"Processing images for user {request.user_id}, session {request.session_id}")
        logger.info(f"PDF path: {request.pdf_path}")
        logger.info(f"Filters: min_size_kb={request.min_size_kb}, min_width={request.min_width}, min_height={request.min_height}")
        
        # Call the image processor
        result = processor.extract_images_from_pdf(
            pdf_path=request.pdf_path,
            user_id=request.user_id,
            session_id=request.session_id,
            min_size_kb=request.min_size_kb,
            min_width=request.min_width,
            min_height=request.min_height
        )
        
        if result["success"]:
            logger.info(f"Successfully processed {result.get('total_count', 0)} images")
            return ProcessImageResponse(
                success=True,
                message=result.get("message", "Images processed successfully"),
                total_count=result.get("total_count", 0),
                images=result.get("images", []),
                stats=result.get("stats", {})
            )
        else:
            logger.error(f"Image processing failed: {result.get('error', 'Unknown error')}")
            return ProcessImageResponse(
                success=False,
                message="Image processing failed",
                error=result.get("error", "Unknown error")
            )
            
    except Exception as e:
        logger.error(f"Exception during image processing: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error during image processing: {str(e)}"
        )

@app.get("/status")
async def get_status():
    """Get processor status and configuration"""
    global processor
    
    if processor is None:
        raise HTTPException(status_code=503, detail="Image processor not initialized")
    
    return {
        "processor_initialized": processor is not None,
        "dependencies_available": processor.deps_available,
        "missing_dependencies": processor.missing_deps if not processor.deps_available else [],
        "data_directory": str(processor.base_data_dir) if processor else None,
        "tesseract_config": processor.tesseract_config if processor else None
    }

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

if __name__ == "__main__":
    # Get configuration from environment variables
    host = os.environ.get("IMAGE_PROCESSOR_HOST", "0.0.0.0")
    port = int(os.environ.get("IMAGE_PROCESSOR_PORT", "8430"))
    
    logger.info(f"Starting Image Processing API server on {host}:{port}")
    
    uvicorn.run(
        "image_processor_api:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )
