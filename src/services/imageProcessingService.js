/**
 * Image Processing Service
 * Integrates with Docker image processor for RAG system
 */

const { spawn } = require('child_process');
const path = require('path');
const config = require('../utils/config');

class ImageProcessingService {
  constructor() {
    // Get image processing configuration
    this.config = config.getSection('image_processing') || {};
    this.enabled = this.config.enabled === 'true' || this.config.enabled === true;
    this.containerName = this.config.docker_container || 'productdemo-image-processor';
    this.minSizeKb = parseInt(this.config.min_size_kb) || 5;
    this.minWidth = parseInt(this.config.min_width) || 100;
    this.minHeight = parseInt(this.config.min_height) || 100;
    this.maxImages = parseInt(this.config.max_images_per_document) || 100;
    
    console.log(`Image Processing Service initialized: enabled=${this.enabled}`);
  }

  /**
   * Check if image processing is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Process images from a PDF document
   * @param {string} documentPath - Path to the PDF file
   * @param {string} userId - User ID for isolation
   * @param {string} sessionId - Session ID (optional)
   * @returns {Promise<Object>} Processing result
   */
  async processDocumentImages(documentPath, userId, sessionId = null) {
    if (!this.enabled) {
      console.log('Image processing is disabled');
      return {
        success: true,
        images: [],
        message: 'Image processing disabled'
      };
    }

    try {
      console.log(`🖼️ Processing images for document: ${documentPath}`);
      console.log(`👤 User: ${userId}, Session: ${sessionId || 'default'}`);

      // Build Docker command
      const args = [
        'compose', 'exec', '-T', this.containerName,
        'python', 'image-processing/user_isolated_image_processor.py',
        documentPath,
        userId
      ];

      // Add optional parameters
      if (sessionId) {
        args.push('--session-id', sessionId);
      }
      
      args.push('--min-size-kb', this.minSizeKb.toString());
      args.push('--min-width', this.minWidth.toString());
      args.push('--min-height', this.minHeight.toString());

      // Execute Docker command
      const result = await this.executeDockerCommand('docker', args);
      
      if (result.success) {
        console.log(`✅ Successfully processed ${result.stats?.processed || 0} images`);
        
        // Limit the number of images if needed
        let images = result.images || [];
        if (images.length > this.maxImages) {
          console.log(`⚠️ Limiting images from ${images.length} to ${this.maxImages}`);
          images = images.slice(0, this.maxImages);
        }
        
        return {
          success: true,
          images: images,
          stats: result.stats,
          collectionPath: result.collection_path
        };
      } else {
        console.error(`❌ Image processing failed: ${result.error}`);
        return {
          success: false,
          error: result.error,
          images: []
        };
      }

    } catch (error) {
      console.error(`💥 Error in image processing: ${error.message}`);
      return {
        success: false,
        error: error.message,
        images: []
      };
    }
  }

  /**
   * Execute Docker command and parse JSON response
   * @param {string} command - Command to execute
   * @param {Array} args - Command arguments
   * @returns {Promise<Object>} Parsed result
   */
  async executeDockerCommand(command, args) {
    return new Promise((resolve, reject) => {
      console.log(`Executing: ${command} ${args.join(' ')}`);
      
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.resolve(__dirname, '../../') // Go to project root
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            // Parse JSON response from Python script
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch (parseError) {
            console.error(`Failed to parse JSON response: ${parseError.message}`);
            console.error(`Raw output: ${stdout}`);
            reject(new Error(`Failed to parse JSON response: ${parseError.message}`));
          }
        } else {
          const errorMsg = `Docker command failed with code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`;
          console.error(errorMsg);
          reject(new Error(errorMsg));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to start Docker command: ${error.message}`));
      });

      // Set timeout for long-running processes
      setTimeout(() => {
        if (!process.killed) {
          process.kill();
          reject(new Error('Image processing timeout'));
        }
      }, 300000); // 5 minutes timeout
    });
  }

  /**
   * Prepare images for vector storage
   * @param {Array} images - Processed images
   * @param {string} documentId - Document ID
   * @param {Object} metadata - Additional metadata
   * @returns {Array} Images formatted for vector storage
   */
  prepareImagesForVectorStorage(images, documentId, metadata = {}) {
    return images.map((image, index) => ({
      image_id: image.image_id,
      page: image.page,
      index: image.index,
      filename: image.filename,
      dimensions: image.dimensions,
      size_kb: image.size_kb,
      format: image.format,
      base64: image.base64,
      keywords: image.keywords,
      timestamp: image.timestamp
    }));
  }

  /**
   * Get image processing statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      containerName: this.containerName,
      filters: {
        minSizeKb: this.minSizeKb,
        minWidth: this.minWidth,
        minHeight: this.minHeight
      },
      maxImages: this.maxImages
    };
  }

  /**
   * Test image processing service
   * @returns {Promise<Object>} Test result
   */
  async testService() {
    if (!this.enabled) {
      return {
        success: false,
        message: 'Image processing is disabled'
      };
    }

    try {
      // Test Docker container availability
      const result = await this.executeDockerCommand('docker', [
        'compose', 'exec', '-T', this.containerName,
        'python', '-c', 'print("Image processing service is available")'
      ]);

      return {
        success: true,
        message: 'Image processing service is available',
        containerName: this.containerName
      };
    } catch (error) {
      return {
        success: false,
        message: `Image processing service test failed: ${error.message}`,
        error: error.message
      };
    }
  }
}

module.exports = new ImageProcessingService();
