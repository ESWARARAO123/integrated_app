/**
 * Integration Example: How to integrate Image Processing with existing RAG system
 * This shows how the Docker image processor would work with your current queue system
 */

const { spawn } = require('child_process');
const path = require('path');

class ImageProcessorIntegration {
  constructor() {
    this.containerName = 'productdemo-image-processor';
  }

  /**
   * Process images from PDF using Docker container
   * This would be called from your existing DocumentProcessor
   */
  async processDocumentImages(documentPath, userId, sessionId = null) {
    try {
      console.log(`🖼️ Processing images for document: ${documentPath}`);
      console.log(`👤 User: ${userId}, Session: ${sessionId || 'default'}`);

      // Build command for Docker container
      const args = [
        'compose', 'exec', '-T', 'image-processor',
        'python', 'image-processing/docker_image_processor.py',
        documentPath,
        userId
      ];

      if (sessionId) {
        args.push('--session-id', sessionId);
      }

      // Execute Docker command
      const result = await this.executeDockerCommand('docker', args);
      
      if (result.success) {
        console.log(`✅ Successfully processed ${result.total_count} images`);
        return {
          success: true,
          images: result.images,
          collectionPath: result.collection_path,
          totalCount: result.total_count
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
      console.error(`💥 Error in image processing integration: ${error.message}`);
      return {
        success: false,
        error: error.message,
        images: []
      };
    }
  }

  /**
   * Execute Docker command and parse JSON response
   */
  async executeDockerCommand(command, args) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.resolve(__dirname, '../../../') // Go to project root
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
            reject(new Error(`Failed to parse JSON response: ${parseError.message}\nOutput: ${stdout}`));
          }
        } else {
          reject(new Error(`Docker command failed with code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to start Docker command: ${error.message}`));
      });
    });
  }

  /**
   * Convert image data to format suitable for vector storage
   * This prepares images for storage in ChromaDB alongside text chunks
   */
  prepareImagesForVectorStorage(images, documentId, metadata = {}) {
    return images.map((image, index) => ({
      id: `${documentId}_image_${image.page}_${image.index}`,
      type: 'image',
      content: image.keywords, // Use keywords as searchable text
      metadata: {
        documentId: documentId.toString(),
        userId: metadata.userId,
        sessionId: metadata.sessionId || null,
        type: 'image',
        imageId: image.image_id,
        page: image.page,
        index: image.index,
        filename: image.filename,
        dimensions: image.dimensions,
        sizeKb: image.size_kb,
        format: image.format,
        base64: image.base64, // Store base64 in metadata
        keywords: image.keywords,
        timestamp: image.timestamp,
        filePath: image.file_path
      }
    }));
  }
}

/**
 * Example integration with existing DocumentProcessor
 * This shows how to modify your current processDocument method
 */
class EnhancedDocumentProcessor {
  constructor() {
    this.imageProcessor = new ImageProcessorIntegration();
    // ... existing initialization
  }

  async processDocument(document, options = {}, onProgress = null) {
    try {
      const { userId, sessionId, jobId, workerId } = options;

      // ... existing text extraction code ...
      await this.reportProgress(30, 'Text extracted, processing images', onProgress);

      // NEW: Process images
      let imageResult = null;
      try {
        imageResult = await this.imageProcessor.processDocumentImages(
          document.file_path,
          userId,
          sessionId
        );

        if (imageResult.success && imageResult.images.length > 0) {
          await this.reportProgress(45, `Extracted ${imageResult.totalCount} images`, onProgress);
          
          // Prepare images for vector storage
          const imageVectors = this.imageProcessor.prepareImagesForVectorStorage(
            imageResult.images,
            document.id,
            { userId, sessionId, fileName: document.original_name }
          );

          // Store images in vector database (same collection as text)
          if (this.vectorStoreService) {
            await this.vectorStoreService.addDocumentImages(
              document.id,
              imageVectors,
              { userId, sessionId, fileName: document.original_name }
            );
          }

          console.log(`✅ Successfully stored ${imageVectors.length} image vectors`);
        } else {
          console.log(`ℹ️ No images extracted from document ${document.id}`);
        }

      } catch (imageError) {
        console.warn(`⚠️ Image processing failed for document ${document.id}: ${imageError.message}`);
        // Continue with text processing even if image processing fails
      }

      // ... existing text chunking and embedding code ...
      await this.reportProgress(60, 'Images processed, generating text embeddings', onProgress);

      // ... rest of existing processing ...

      return {
        success: true,
        textChunks: chunks.length,
        imageCount: imageResult?.totalCount || 0,
        message: `Document processed: ${chunks.length} text chunks, ${imageResult?.totalCount || 0} images`,
        jobId,
        workerId
      };

    } catch (error) {
      // ... existing error handling ...
    }
  }

  async reportProgress(progress, message, onProgress) {
    if (onProgress && typeof onProgress === 'function') {
      await onProgress({
        progress,
        message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

/**
 * Example RAG query response with images
 * This shows how the enhanced RAG service would return both text and images
 */
class EnhancedRagService {
  async processRagChat(message, model, options = {}) {
    try {
      const { sessionId, userId } = options;

      // Generate embedding for user query
      const queryEmbedding = await this.ollamaService.generateEmbedding(message);

      // Search for both text and images (increased limit to get both types)
      const searchResults = await this.vectorStoreService.search(queryEmbedding, {
        limit: 20, // Increased to get both text and images
        sessionId,
        userId
      });

      // Separate text and image results
      const textResults = searchResults
        .filter(result => !result.metadata.type || result.metadata.type !== 'image')
        .slice(0, 10);

      const imageResults = searchResults
        .filter(result => result.metadata.type === 'image')
        .slice(0, 3); // Top 3 relevant images

      // Build context from text results
      const context = textResults.map(result => result.content).join('\n\n');

      // Generate response using text context
      const response = await this.ollamaService.generateResponse(message, context, model);

      // Prepare image data for response
      const relevantImages = imageResults.map(result => ({
        imageId: result.metadata.imageId,
        base64: result.metadata.base64,
        keywords: result.metadata.keywords,
        page: result.metadata.page,
        filename: result.metadata.filename,
        dimensions: result.metadata.dimensions,
        score: result.score,
        relevanceReason: `Matched keywords: ${result.metadata.keywords}`
      }));

      return {
        success: true,
        response: response,
        sources: textResults.map(result => ({
          content: result.content.substring(0, 200) + '...',
          score: result.score,
          metadata: result.metadata
        })),
        images: relevantImages, // NEW: Include relevant images
        context: context,
        stats: {
          textSources: textResults.length,
          imageSources: imageResults.length,
          totalSearched: searchResults.length
        }
      };

    } catch (error) {
      console.error('Error in enhanced RAG chat processing:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = {
  ImageProcessorIntegration,
  EnhancedDocumentProcessor,
  EnhancedRagService
};
