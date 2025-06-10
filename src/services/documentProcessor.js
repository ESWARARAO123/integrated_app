const fs = require('fs');
const path = require('path');
// Don't require documentService here to avoid circular dependency
// We'll use a function to get it when needed
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const { loadPathsFromConfig, ensureDirectoriesExist } = require('../utils/pathConfig');
const { spawn, exec } = require('child_process');
const ini = require('ini');
const { chunkBySection } = require('../utils/headerChunker');
const { extractTextAndTablesSmart } = require('./pdfProcessor');
const FileCleanupService = require('./fileCleanupService');

// Helper function to get documentService only when needed
function getDocumentService() {
  return require('./documentService');
}

// Read config.ini file to get Python interpreter path
function getPythonConfig() {
  try {
    const configPath = path.resolve(process.cwd(), './conf/config.ini');
    if (fs.existsSync(configPath)) {
      const config = ini.parse(fs.readFileSync(configPath, 'utf-8'));
      return {
        // Use Python 3.9 from virtual environment by default if not specified in config
        pythonInterpreter: config.python?.interpreter || './python/venv/bin/python',
      };
    }
    return { pythonInterpreter: './python/venv/bin/python' };
  } catch (error) {
    console.warn('Error reading Python config:', error);
    return { pythonInterpreter: './python/venv/bin/python' };
  }
}

// Get the OllamaService
let OllamaService;
try {
  OllamaService = require('./ollamaService');
} catch (error) {
  console.warn('OllamaService not found. Embedding generation will be limited.');
}

// Import LangChain components
let PDFLoader;
let DocxLoader;
let RecursiveCharacterTextSplitter;
try {
  console.log('Attempting to load LangChain components...');
  const { PDFLoader: PDFLoaderImport } = require('@langchain/community/document_loaders/fs/pdf');
  PDFLoader = PDFLoaderImport;
  console.log('LangChain PDFLoader loaded successfully.');

  const { RecursiveCharacterTextSplitter: TextSplitterImport } = require('langchain/text_splitter');
  RecursiveCharacterTextSplitter = TextSplitterImport;
  console.log('LangChain RecursiveCharacterTextSplitter loaded successfully.');

  // Try to import DocxLoader if available
  try {
    const { DocxLoader: DocxLoaderImport } = require('@langchain/community/document_loaders/fs/docx');
    DocxLoader = DocxLoaderImport;
    console.log('LangChain DocxLoader loaded successfully.');
  } catch (docxError) {
    console.warn(`LangChain DocxLoader not available: ${docxError.message}. Using fallback for DOCX files.`);
    DocxLoader = null;
  }

  console.log('All available LangChain components loaded successfully for document processing.');
} catch (error) {
  console.error(`Error loading LangChain components: ${error.message}`, error);
  console.warn('LangChain packages not found or failed to load. Using fallback document processing methods.');
  console.warn('If you have recently installed langchain, ensure the application was restarted.');
  console.warn('Verify that "langchain" is listed in your package.json and installed in node_modules.');
  PDFLoader = null;
  DocxLoader = null;
  RecursiveCharacterTextSplitter = null;
}

// We'll use these packages if they're available, but provide fallbacks if not
let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (error) {
  console.warn('pdf-parse package not found. PDF text extraction will be limited.');
  pdfParse = null;
}

let mammoth;
try {
  mammoth = require('mammoth');
} catch (error) {
  console.warn('mammoth package not found. DOCX text extraction will be limited.');
  mammoth = null;
}

/**
 * Service for processing documents (text extraction, chunking, embedding generation)
 */
class DocumentProcessor {
  constructor() {
    // Load paths from config and ensure directories exist
    const paths = loadPathsFromConfig();
    ensureDirectoriesExist(paths);

    // Set directory paths from config
    this.documentsDir = paths.documentsDir;
    this.embeddingsDir = paths.embeddingsDir;

    // Get Python configuration
    const pythonConfig = getPythonConfig();
    this.pythonInterpreter = pythonConfig.pythonInterpreter;

    // Set up services
    this.ollamaService = null;
    this.vectorStoreService = null;
    this.fileCleanupService = new FileCleanupService();
    // Don't store documentService directly to avoid circular dependency
    this.config = {
      embedding: {
        model: 'nomic-embed-text',
        batchSize: 5,
        dimensions: 768
      },
      vectorStore: {
        persistDirectory: paths.chromaDataDir,
        collectionName: 'rag_docs'
      }
    };

    // Initialize services as soon as we can
    this.initOllamaService();
    this.initVectorStoreService();
  }

  /**
   * Initialize the Ollama service for embedding generation
   */
  async initOllamaService() {
    if (!OllamaService) {
      console.warn('OllamaService not available, using placeholder embeddings');
      return false;
    }

    try {
      // Create Ollama service instance
      this.ollamaService = new OllamaService(this.config);
      await this.ollamaService.initialize();
      console.log('OllamaService initialized for document processing');
      return true;
    } catch (error) {
      console.error('Failed to initialize OllamaService:', error);
      this.ollamaService = null;
      return false;
    }
  }

  /**
   * Initialize the Vector Store service for embedding storage
   */
  async initVectorStoreService() {
    try {
      // Get the vectorStoreService
      const vectorStoreService = require('./vectorStoreService');
      if (!vectorStoreService) {
        console.warn('VectorStoreService not available, using file-based storage only');
        return false;
      }

      this.vectorStoreService = vectorStoreService;
      console.log('VectorStoreService initialized for document processing');
      return true;
    } catch (error) {
      console.error('Failed to initialize VectorStoreService:', error);
      console.error(error.stack);
      this.vectorStoreService = null;
      return false;
    }
  }

  /**
   * Process a document from file to embeddings
   * @param {Object} document - Document object with file path
   * @param {Object} options - Processing options
   * @param {Function} onProgress - Optional progress callback function
   * @returns {Promise<Object>} - Processing result
   */
  async processDocument(document, options = {}, onProgress = null) {
    try {
      const {
        userId = document.user_id,
        sessionId = null,
        jobId = null, // Job ID from queue system
        workerId = null // Worker ID for tracking
      } = options;

      // Resolve the actual sessionId to use - prioritize options.sessionId, then document.session_id
      const actualSessionId = sessionId || document.session_id || null;

      console.log(`Processing document ${document.id}: ${document.original_name}${actualSessionId ? ` for session ${actualSessionId}` : ''}${jobId ? ` (Job: ${jobId})` : ''}`);

      // Enhanced progress reporting function
      const reportProgress = async (progress, message, additionalData = {}) => {
        const progressData = {
          documentId: document.id,
          progress,
          message,
          status: progress >= 100 ? 'completed' : 'processing',
          jobId,
          workerId,
          timestamp: new Date().toISOString(),
          ...additionalData
        };

        // Call external progress callback if provided
        if (onProgress && typeof onProgress === 'function') {
          try {
            await onProgress(progressData);
          } catch (callbackError) {
            console.error(`Error in progress callback for document ${document.id}:`, callbackError);
          }
        }

        // Update internal progress tracking
        await this.updateDocumentProgress(document.id, progressData);
      };

      // Update progress to indicate start
      await reportProgress(10, 'Started document processing', { phase: 'initialization' });

      // Extract text from the document with enhanced error handling
      let textResult;
      try {
        textResult = await this.extractText(document);
        if (!textResult.success) {
          throw new Error(`Text extraction failed: ${textResult.error}`);
        }
      } catch (extractionError) {
        console.error(`Text extraction error for document ${document.id}:`, extractionError);
        await reportProgress(0, `Text extraction failed: ${extractionError.message}`, { 
          phase: 'text_extraction',
          error: extractionError.message 
        });
        return {
          success: false,
          error: `Text extraction failed: ${extractionError.message}`,
          phase: 'text_extraction'
        };
      }

      // Update progress after text extraction
      await reportProgress(30, 'Text extracted, chunking document', {
        phase: 'text_extraction_complete',
        textLength: textResult.text.length
      });

      // Process images if enabled and document is PDF
      let imageResult = { success: true, total_count: 0 };
      if (document.file_type === 'pdf') {
        try {
          imageResult = await this.processDocumentImages(document, { userId, sessionId: actualSessionId });
          if (imageResult.success && imageResult.total_count > 0) {
            await reportProgress(40, `Processed ${imageResult.total_count} images`, {
              phase: 'image_processing_complete',
              imageCount: imageResult.total_count
            });
          }
        } catch (imageError) {
          console.warn(`Image processing failed for document ${document.id}:`, imageError.message);
          // Continue with text processing even if image processing fails
        }
      }

      // Split text into chunks with enhanced error handling
      let chunks;
      try {
        chunks = await this.chunkText(textResult.text, document.file_type);
        console.log(`Document ${document.id} chunked into ${chunks.length} segments`);
      } catch (chunkingError) {
        console.error(`Text chunking error for document ${document.id}:`, chunkingError);
        await reportProgress(30, `Text chunking failed: ${chunkingError.message}`, { 
          phase: 'chunking',
          error: chunkingError.message 
        });
        return {
          success: false,
          error: `Text chunking failed: ${chunkingError.message}`,
          phase: 'chunking'
        };
      }

      // Update progress after chunking
      await reportProgress(60, 'Document chunked, generating embeddings', {
        phase: 'chunking_complete',
        chunkCount: chunks.length
      });

      // Generate embeddings for the chunks with enhanced error handling
      let embeddingsResult;
      try {
        embeddingsResult = await this.generateEmbeddings(chunks, document.id, userId, actualSessionId, onProgress);
        if (!embeddingsResult.success) {
          throw new Error(`Embedding generation failed: ${embeddingsResult.error}`);
        }
      } catch (embeddingError) {
        console.error(`Embedding generation error for document ${document.id}:`, embeddingError);
        await reportProgress(60, `Embedding generation failed: ${embeddingError.message}`, {
          phase: 'embedding_generation',
          error: embeddingError.message
        });
        return {
          success: false,
          error: `Embedding generation failed: ${embeddingError.message}`,
          phase: 'embedding_generation'
        };
      }

      // Update progress after embedding generation
      await reportProgress(100, 'Document processing completed', {
        phase: 'completed',
        chunkCount: chunks.length,
        embeddingCount: embeddingsResult.embeddings?.length || chunks.length,
        processingTime: Date.now() - new Date().getTime()
      });

      console.log(`Document ${document.id} processing completed: ${chunks.length} chunks processed`);

      // Schedule automatic file cleanup after successful processing
      try {
        const cleanupResult = await this.fileCleanupService.scheduleCleanup(
          document.file_path,
          {
            id: document.id,
            original_name: document.original_name,
            user_id: userId,
            session_id: actualSessionId
          },
          true // processing was successful
        );

        if (cleanupResult.scheduled) {
          console.log(`File cleanup scheduled for document ${document.id}: ${document.file_path}`);
        } else {
          console.log(`File cleanup not scheduled for document ${document.id}: ${cleanupResult.reason}`);
        }
      } catch (cleanupError) {
        // Don't let cleanup errors affect the processing result
        console.error(`Error scheduling file cleanup for document ${document.id}:`, cleanupError.message);
      }

      return {
        success: true,
        chunks: chunks.length,
        embeddings: embeddingsResult.embeddings?.length || chunks.length,
        message: `Document processed successfully: ${chunks.length} chunks created`,
        jobId,
        workerId,
        cleanupScheduled: true
      };

    } catch (error) {
      console.error(`Error processing document ${document.id}:`, error);
      
      // Enhanced error reporting
      const errorData = {
        documentId: document.id,
        status: 'error',
        message: `Processing error: ${error.message}`,
        error: error.message,
        errorStack: error.stack,
        jobId: options.jobId,
        workerId: options.workerId,
        timestamp: new Date().toISOString()
      };

      // Call error callback if provided
      if (onProgress && typeof onProgress === 'function') {
        try {
          await onProgress(errorData);
        } catch (callbackError) {
          console.error(`Error in error callback for document ${document.id}:`, callbackError);
        }
      }

      await this.updateDocumentProgress(document.id, errorData);

      // Handle file cleanup for failed processing (based on configuration)
      try {
        const cleanupResult = await this.fileCleanupService.scheduleCleanup(
          document.file_path,
          {
            id: document.id,
            original_name: document.original_name,
            user_id: document.user_id,
            session_id: document.session_id
          },
          false // processing failed
        );

        if (cleanupResult.scheduled) {
          console.log(`File cleanup scheduled for failed document ${document.id}: ${document.file_path}`);
        } else {
          console.log(`File cleanup not scheduled for failed document ${document.id}: ${cleanupResult.reason}`);
        }
      } catch (cleanupError) {
        // Don't let cleanup errors affect the error response
        console.error(`Error scheduling file cleanup for failed document ${document.id}:`, cleanupError.message);
      }

      return {
        success: false,
        error: error.message,
        jobId: options.jobId,
        workerId: options.workerId
      };
    }
  }

  /**
   * Generate embeddings for document chunks
   * @param {Array} chunks - Document text chunks
   * @param {string} documentId - Document ID
   * @param {string} userId - User ID
   * @param {string} sessionId - Optional session ID
   * @param {Function} onProgress - Optional progress callback function
   * @returns {Promise<Object>} - Result with embeddings
   */
  async generateEmbeddings(chunks, documentId, userId, sessionId = null, onProgress = null) {
    try {
      console.log(`Generating embeddings for document ${documentId}, ${chunks.length} chunks${sessionId ? `, session ${sessionId}` : ''}`);

      // Initialize embedding generator if needed
      if (!this.ollamaService) {
        await this.initOllamaService();
      }

      // If we still don't have OllamaService, use placeholder embeddings
      if (!this.ollamaService) {
        console.warn(`OllamaService not available, using placeholder embeddings for document ${documentId}`);

        // Generate placeholder embeddings (random vectors)
        const placeholderEmbeddings = chunks.map(() => {
          // Create a random 768-dimensional vector (typical embedding size)
          const dimensions = 768;
          const embedding = Array(dimensions).fill(0).map(() => (Math.random() * 2) - 1);

          // Normalize the vector to unit length
          const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
          return embedding.map(val => val / magnitude);
        });

        console.log(`Generated ${placeholderEmbeddings.length} placeholder embeddings for document ${documentId}`);

        // Continue with vector storage using placeholder embeddings
        if (this.vectorStoreService) {
          try {
            console.log(`Storing ${chunks.length} placeholder embeddings in vector store for document ${documentId}`);

            // Get document service using helper function to avoid circular dependency
            const documentService = getDocumentService();
            // Get document metadata
            const document = await documentService.getDocument(documentId);

            // Prepare chunks with embeddings for vector store
            const chunksWithEmbeddings = chunks.map((chunk, index) => ({
              text: chunk.text,
              embedding: placeholderEmbeddings[index]
            }));

            // Add chunks to vector store with session ID in metadata
            const vectorStoreResult = await this.vectorStoreService.addDocumentChunks(
              chunksWithEmbeddings,
              documentId,
              {
                fileName: document.original_name,
                userId: document.user_id || userId,
                fileType: document.file_type,
                sessionId: sessionId || document.session_id || null
              }
            );

            if (!vectorStoreResult.success) {
              console.error(`Error storing placeholder embeddings in vector store:`, vectorStoreResult.error);
            } else {
              console.log(`Successfully stored ${vectorStoreResult.count} placeholder vectors for document ${documentId}`);
            }
          } catch (storeError) {
            console.error(`Error storing placeholder embeddings in vector store:`, storeError);
          }
        }

        return {
          success: true,
          embeddings: placeholderEmbeddings,
          message: `Generated ${placeholderEmbeddings.length} placeholder embeddings for document ${documentId} (Ollama unavailable)`
        };
      }

      // Prepare texts for embedding
      const texts = chunks.map(chunk => chunk.text);

      // Report progress before starting embeddings
      if (onProgress) {
        await onProgress(70, `Generating embeddings for ${texts.length} chunks`);
      }

      // Generate embeddings using Ollama in batches
      const result = await this.ollamaService.generateBatchEmbeddings(texts);
      if (!result.success) {
        console.error(`Error generating embeddings:`, result.error);
        return result;
      }

      // Report progress after embeddings are generated
      if (onProgress) {
        await onProgress(90, `Storing ${result.embeddings.length} embeddings`);
      }

      // Store embeddings in vector database if available
      if (this.vectorStoreService) {
        try {
          console.log(`Storing ${chunks.length} embeddings in vector store for document ${documentId}`);

          // Get document service using helper function to avoid circular dependency
          const documentService = getDocumentService();
          // Get document metadata for storage
          const document = await documentService.getDocument(documentId);

          // Add chunks to vector store with session ID in metadata if available
          const vectorStoreResult = await this.vectorStoreService.addDocumentChunks(
            documentId,
            chunks.map(chunk => chunk.text),
            result.embeddings,
            {
              fileName: document.original_name || document.file_path.split('/').pop(),
              userId: document.user_id || userId,
              fileType: document.file_type,
              sessionId: sessionId || document.session_id || null  // Include session ID in metadata
            }
          );

          if (!vectorStoreResult) {
            console.error(`Vector store returned undefined result for document ${documentId}`);
          } else {
            console.log(`Successfully stored vectors in store for document ${documentId}`);
          }
        } catch (storeError) {
          console.error(`Error storing embeddings in vector store:`, storeError);
          // Continue even if vector store fails
        }
      }

      return {
        success: true,
        embeddings: result.embeddings,
        message: `Generated ${result.embeddings.length} embeddings for document ${documentId}`
      };
    } catch (error) {
      console.error(`Error generating embeddings:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract text from a document based on its file type
   * @param {Object} document - Document object
   * @returns {Promise<Object>} - Object with extracted text or error
   */
  async extractText(document) {
    if (!document || !document.file_path) {
      return {
        success: false,
        error: 'Invalid document or missing file path'
      };
    }

    // Get the file path and resolve it properly for the current system
    let { file_path, file_type } = document;

    // Fix file path resolution for cross-platform compatibility
    let resolvedFilePath = file_path;

    // If the stored path is from a different system, try to resolve it
    if (file_path.includes('/home/') || file_path.includes('/Users/')) {
      // This is a Linux/Mac path, let's try to find the file in the current DATA directory
      console.log(`Detected cross-platform path: ${file_path}`);
      
      // Extract the relative path from the user_id onward
      const pathParts = file_path.split('/');
      const userIdIndex = pathParts.findIndex(part => part.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/));
      
      if (userIdIndex > 0) {
        // Rebuild the path using current system's DATA directory
        const relativePath = pathParts.slice(userIdIndex).join(path.sep);
        resolvedFilePath = path.join(this.documentsDir, relativePath);
        console.log(`Resolved cross-platform path to: ${resolvedFilePath}`);
      }
    }

    // Ensure we're using the DATA directory structure
    if (!resolvedFilePath.includes('DATA') && !resolvedFilePath.includes(this.documentsDir)) {
      // If the path doesn't include DATA, try to construct it
      if (document.user_id && document.id) {
        const fileName = path.basename(resolvedFilePath);
        resolvedFilePath = path.join(this.documentsDir, document.user_id, fileName);
        console.log(`Constructed new path: ${resolvedFilePath}`);
      }
    }

    console.log(`Extracting text from ${resolvedFilePath} (${file_type})`);

    // Check if the file actually exists
    if (!fs.existsSync(resolvedFilePath)) {
      console.error(`File not found at ${resolvedFilePath}`);
      
      // Try alternative paths
      const alternatives = [
        // Try with the original filename in the user directory
        path.join(this.documentsDir, document.user_id, document.original_name),
        // Try with just the basename in the user directory
        path.join(this.documentsDir, document.user_id, path.basename(file_path)),
        // Try the original path as-is (in case it's correct)
        file_path
      ];

      for (const altPath of alternatives) {
        if (fs.existsSync(altPath)) {
          console.log(`Found file at alternative path: ${altPath}`);
          resolvedFilePath = altPath;
          break;
        }
      }

      // If still not found, return an error
      if (!fs.existsSync(resolvedFilePath)) {
        return {
          success: false,
          error: `File not found. Tried paths: ${resolvedFilePath}, ${alternatives.join(', ')}`
        };
      }
    }

    try {
      let text = '';

      // Extract based on file type
      switch (file_type.toLowerCase()) {
        case 'application/pdf':
        case 'pdf':
          text = await this.extractPdfText(resolvedFilePath);
          break;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'docx':
          text = await this.extractDocxText(resolvedFilePath);
          break;

        case 'text/plain':
        case 'txt':
          text = await readFile(resolvedFilePath, 'utf8');
          break;

        default:
          return {
            success: false,
            error: `Unsupported file type: ${file_type}`
          };
      }

      // Check if we got any text back
      if (!text || text.length === 0) {
        return {
          success: false,
          error: 'No text could be extracted from the document'
        };
      }

      console.log(`Successfully extracted ${text.length} characters from ${resolvedFilePath}`);

      return {
        success: true,
        text,
        length: text.length
      };
    } catch (error) {
      console.error(`Error extracting text from ${resolvedFilePath}:`, error);
      return {
        success: false,
        error: `Failed to extract text: ${error.message}`
      };
    }
  }

  /**
   * Extract text from a PDF file
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<string>} - Extracted text
   */
  async extractPdfText(filePath) {
    try {
      // First try using the Python pdfplumber extraction with table support
      console.log(`Attempting to extract PDF text with tables using pdfplumber for ${filePath}`);
      try {
        const tableResult = await extractTextAndTablesSmart(filePath);
        if (tableResult.success) {
          console.log(`Successfully extracted ${tableResult.text.length} characters from PDF with ${tableResult.hasTables ? 'tables' : 'no tables'}`);
          return tableResult.text;
        } else {
          console.warn(`Table-aware extraction failed: ${tableResult.error}. Falling back to text-only extraction.`);
        }
      } catch (tableError) {
        console.warn(`Table-aware extraction error: ${tableError.message}. Falling back to text-only extraction.`);
      }
      
      // Fall back to basic text extraction if table extraction fails
      console.log(`Attempting to extract PDF text using basic pdfplumber for ${filePath}`);
      try {
        const smartResult = await this.extractTextSmart(filePath);
        if (smartResult.success) {
          console.log(`Successfully extracted ${smartResult.text.length} characters from PDF using basic pdfplumber`);
          return smartResult.text;
        } else {
          console.warn(`Python pdfplumber extraction failed: ${smartResult.error}. Falling back to other methods.`);
        }
      } catch (pythonError) {
        console.warn(`Python pdfplumber extraction error: ${pythonError.message}. Falling back to other methods.`);
      }
      
      // Try using LangChain's PDFLoader as the first fallback
      if (PDFLoader) {
        console.log(`Using LangChain PDFLoader for ${filePath}`);
        try {
          const loader = new PDFLoader(filePath, {
            splitPages: false // We want the full text, we'll do our own chunking
          });
          const docs = await loader.load();

          // Combine all page content
          const fullText = docs.map(doc => doc.pageContent).join('\n\n');
          console.log(`Successfully extracted ${docs.length} pages from PDF using LangChain`);
          return fullText;
        } catch (langchainError) {
          console.warn(`LangChain PDF extraction failed: ${langchainError.message}. Falling back to pdf-parse.`);
          // Fall through to pdf-parse
        }
      }

      // Fall back to pdf-parse if LangChain fails or isn't available
      if (pdfParse) {
        console.log(`Using pdf-parse for ${filePath}`);
        const dataBuffer = await readFile(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
      } else {
        // Final fallback: read the file as binary and return a placeholder
        console.warn(`PDF parsing not available for ${filePath}. Install pdf-parse package for better results.`);
        return `[PDF content from ${path.basename(filePath)}. Install pdf-parse package for text extraction.]`;
      }
    } catch (error) {
      console.error(`Error extracting text from PDF ${filePath}:`, error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF using Python pdfplumber
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<Object>} - Result with extracted text or error
   */
  async extractTextSmart(filePath) {
    return new Promise((resolve) => {
      try {
        // Path to the Python script in the python/RAG-MODULE directory
        const pythonScriptPath = path.resolve(process.cwd(), 'python/RAG-MODULE/extract_text.py');
        
        // Check if the Python script exists
        if (!fs.existsSync(pythonScriptPath)) {
          console.warn(`Python script not found at ${pythonScriptPath}`);
          return resolve({
            success: false,
            error: `Python script not found at ${pythonScriptPath}`
          });
        }
        
        // Check if the PDF file exists and is accessible
        if (!fs.existsSync(filePath)) {
          console.warn(`PDF file not found at ${filePath}`);
          return resolve({
            success: false,
            error: `PDF file not found at ${filePath}`
          });
        }
        
        console.log(`Running Python script with interpreter ${this.pythonInterpreter}`);
        console.log(`Script path: ${pythonScriptPath}`);
        console.log(`PDF path: ${filePath}`);
        
        // Execute the Python script (Python 3.9 from virtual environment) as a child process
        const pythonProcess = spawn(this.pythonInterpreter, [pythonScriptPath, filePath]);
        
        let stdout = '';
        let stderr = '';
        
        // Collect stdout data
        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        // Collect stderr data
        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString();
          console.warn(`Python stderr: ${data.toString()}`);
        });
        
        // Handle process completion
        pythonProcess.on('close', (code) => {
          if (code !== 0) {
            console.warn(`Python process exited with code ${code}`);
            console.warn(`stderr: ${stderr}`);
            
            // Check if the error indicates missing dependencies
            if (stderr.includes('ModuleNotFoundError: No module named') || 
                stderr.includes('ImportError:')) {
              console.warn('Python module dependency missing. You may need to install required packages.');
              console.warn('Try: pip install --user pdfplumber');
            }
            
            return resolve({
              success: false,
              error: `Python extraction failed with code ${code}: ${stderr}`
            });
          }
          
          try {
            // Try to parse JSON output
            let jsonOutput = stdout.trim();
            
            // Handle case where there might be non-JSON content in stdout
            const jsonStart = jsonOutput.indexOf('{');
            if (jsonStart > 0) {
              console.warn(`Non-JSON prefix in output: ${jsonOutput.substring(0, jsonStart)}`);
              jsonOutput = jsonOutput.substring(jsonStart);
            }
            
            const result = JSON.parse(jsonOutput);
            
            if (!result.success) {
              console.warn(`Python extraction reported failure: ${result.error}`);
              
              // Check for pdfplumber installation issue
              if (result.error && result.error.includes('pdfplumber module not installed')) {
                console.warn('pdfplumber module not installed in Python environment.');
                console.warn('Please install it using: pip install --user pdfplumber');
              }
              
              return resolve({
                success: false,
                error: result.error || 'Unknown error in Python extraction'
              });
            }
            
            console.log(`Successfully extracted ${result.page_count} pages with Python pdfplumber`);
            
            return resolve({
              success: true,
              text: result.text,
              pageCount: result.page_count,
              pages: result.pages
            });
          } catch (parseError) {
            console.error('Error parsing Python script output:', parseError);
            console.error('Raw output:', stdout);
            
            return resolve({
              success: false,
              error: `Error parsing Python output: ${parseError.message}`,
              rawOutput: stdout.substring(0, 500) // Include part of the raw output for debugging
            });
          }
        });
        
        // Handle process errors
        pythonProcess.on('error', (error) => {
          console.error('Error executing Python script:', error);
          
          // Check for specific errors
          if (error.code === 'ENOENT') {
            console.error(`Python interpreter '${this.pythonInterpreter}' not found.`);
            console.error('Please check your config.ini file and ensure the python.interpreter path is correct.');
          }
          
          return resolve({
            success: false,
            error: `Failed to execute Python script: ${error.message} (${error.code})`,
            hint: error.code === 'ENOENT' ? 'Python interpreter not found. Check config.ini.' : null
          });
        });
        
        // Set a timeout for the Python process (30 seconds)
        const timeout = setTimeout(() => {
          console.warn('Python process is taking too long, killing it...');
          pythonProcess.kill();
          
          return resolve({
            success: false,
            error: 'Python extraction timed out after 30 seconds'
          });
        }, 30000);
        
        // Clear the timeout when the process completes
        pythonProcess.on('close', () => {
          clearTimeout(timeout);
        });
      } catch (error) {
        console.error('Error in extractTextSmart:', error);
        return resolve({
          success: false,
          error: `Exception in extractTextSmart: ${error.message}`
        });
      }
    });
  }

  /**
   * Extract text from a DOCX file
   * @param {string} filePath - Path to the DOCX file
   * @returns {Promise<string>} - Extracted text
   */
  async extractDocxText(filePath) {
    try {
      // Try using LangChain's DocxLoader first
      if (DocxLoader) {
        console.log(`Using LangChain DocxLoader for ${filePath}`);
        try {
          const loader = new DocxLoader(filePath);
          const docs = await loader.load();

          // Combine all content
          const fullText = docs.map(doc => doc.pageContent).join('\n\n');
          console.log(`Successfully extracted DOCX content using LangChain`);
          return fullText;
        } catch (langchainError) {
          console.warn(`LangChain DOCX extraction failed: ${langchainError.message}. Falling back to mammoth.`);
          // Fall through to mammoth
        }
      }

      // Fall back to mammoth if LangChain fails or isn't available
      if (mammoth) {
        console.log(`Using mammoth for ${filePath}`);
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
      } else {
        // Final fallback: read the file as binary and return a placeholder
        console.warn(`DOCX parsing not available for ${filePath}. Install mammoth package for better results.`);
        return `[DOCX content from ${path.basename(filePath)}. Install mammoth package for text extraction.]`;
      }
    } catch (error) {
      console.error(`Error extracting text from DOCX ${filePath}:`, error);
      throw new Error(`Failed to extract text from DOCX: ${error.message}`);
    }
  }

  /**
   * Update document processing progress
   * @param {string} documentId - Document ID
   * @param {Object} progress - Progress info
   * @returns {Promise<void>}
   */
  async updateDocumentProgress(documentId, progress) {
    if (!documentId) {
      console.warn('Cannot update progress: Document ID is undefined');
      return;
    }

    try {
      const { status, progress: progressValue, message } = progress;

      // Default status to 'processing' if not provided
      const docStatus = status || 'processing';

      console.log(`Updating document ${documentId} progress: ${progressValue || 0}% - ${message || 'Processing'} (status: ${docStatus})`);

      // Get document service using helper function to avoid circular dependency
      const documentService = getDocumentService();

      // Try to get the document first to verify it exists
      let document;
      try {
        document = await documentService.getDocument(documentId);
        if (!document) {
          console.warn(`Cannot update progress: Document ${documentId} not found in database`);
          return;
        }
      } catch (docError) {
        console.warn(`Cannot update progress: Error retrieving document ${documentId}: ${docError.message}`);
        return;
      }

      // Update document status through document service
      await documentService.updateDocumentStatus(
        documentId,
        docStatus,
        message,
        true // Mark as long-running to prevent session timeout
      );

      // Send WebSocket update if the app server is available
      try {
        // Get the WebSocket server from the global app object
        const app = global.app;
        if (app && app.get('wsServer')) {
          const wsServer = app.get('wsServer');

          // Create WebSocket payload
          const wsPayload = {
            type: 'document_status_update',
            payload: {
              documentId: documentId,
              status: docStatus,
              progress: progressValue || 0,
              message: message || 'Processing',
              timestamp: new Date().toISOString()
            }
          };

          // If we have a user ID, send to that specific user
          if (document.user_id) {
            console.log(`Broadcasting document status update to user ${document.user_id}`);

            // Try to broadcast up to 3 times with increasing delays if needed
            let attempt = 0;
            const maxAttempts = 3;
            let success = false;

            while (attempt < maxAttempts && !success) {
              try {
                if (attempt > 0) {
                  console.log(`Retry attempt ${attempt} for broadcasting to user ${document.user_id}`);
                  // Add increasing delay between retries
                  await new Promise(resolve => setTimeout(resolve, attempt * 500));
                }

                success = wsServer.broadcastToUser(document.user_id, wsPayload);

                if (!success && attempt < maxAttempts - 1) {
                  console.log(`Broadcast attempt ${attempt + 1} failed, will retry`);
                }
              } catch (retryError) {
                console.error(`Error in broadcast attempt ${attempt + 1}:`, retryError);
              }

              attempt++;
            }

            if (!success) {
              console.log(`All ${maxAttempts} broadcast attempts failed for user ${document.user_id}, message will be queued if supported`);
            }
          } else {
            // Fallback to broadcasting to all users if no user ID is available
            console.log('Broadcasting document status update to all users (no user ID available)');
            wsServer.broadcastToAll(wsPayload);
          }
        }
      } catch (wsError) {
        // Don't let WebSocket errors interrupt the process
        console.error(`Error sending WebSocket update for document ${documentId}:`, wsError);
      }

      console.log(`Document ${documentId} progress updated: ${progressValue || 0}% - ${message || 'Processing'}`);
    } catch (error) {
      console.error(`Error updating document progress for ${documentId}: ${error.message}`);
      // Don't throw - we don't want to interrupt processing due to progress update failure
    }
  }

  /**
   * Split text into chunks for processing
   * @param {string} text - Text to split into chunks
   * @param {string} fileType - File type for optimizing chunking strategy
   * @param {number} chunkSize - Target chunk size in characters
   * @param {number} chunkOverlap - Overlap between chunks in characters
   * @returns {Array<Object>} - Array of text chunks with metadata
   */
  async chunkText(text, fileType, chunkSize = 1000, chunkOverlap = 200) {
    if (!text || text.length === 0) {
      return [];
    }

    console.log(`Chunking text (${text.length} chars) with size=${chunkSize}, overlap=${chunkOverlap}`);

    // Try using LangChain's RecursiveCharacterTextSplitter if available
    if (RecursiveCharacterTextSplitter) {
      try {
        console.log(`Using LangChain RecursiveCharacterTextSplitter`);

        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: chunkSize,
          chunkOverlap: chunkOverlap,
          // These separators help ensure chunks break at natural boundaries
          separators: ["\n\n", "\n", ". ", "! ", "? ", ".", "!", "?", ";", ":", " ", ""]
        });

        // Split the text
        const langchainChunks = await splitter.createDocuments([text]);

        // Convert LangChain documents to our chunk format
        const chunks = langchainChunks.map((doc, index) => {
          return {
            text: doc.pageContent,
            index: index,
            length: doc.pageContent.length
          };
        });

        console.log(`LangChain text splitting created ${chunks.length} chunks`);
        return chunks;
      } catch (error) {
        console.warn(`LangChain text splitting failed: ${error.message}. Using fallback chunking method.`);
        // Fall through to custom implementation
      }
    }

    // Try header-based chunking for structured documents (pdf, docx)
    const structuredDocTypes = ['application/pdf', 'pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'];
    if (structuredDocTypes.includes(fileType?.toLowerCase())) {
      console.log(`Using header-based chunking for structured document type: ${fileType}`);
      try {
        // Use the header-based chunking strategy
        const headerChunks = chunkBySection(text, { 
          chunkSize, 
          overlap: chunkOverlap 
        });
        
        // Transform the chunks to match the expected format
        const formattedChunks = headerChunks.map(chunk => ({
          text: chunk.text,
          index: chunk.index,
          length: chunk.text.length,
          // Include section title as metadata
          metadata: { sectionTitle: chunk.sectionTitle }
        }));
        
        console.log(`Header-based chunking created ${formattedChunks.length} chunks from sections`);
        
        if (formattedChunks.length > 0) {
          // Log some section titles for debugging
          const sampleTitles = formattedChunks
            .slice(0, Math.min(5, formattedChunks.length))
            .map(chunk => chunk.metadata.sectionTitle);
          console.log(`Section titles found: ${sampleTitles.join(', ')}${formattedChunks.length > 5 ? '...' : ''}`);
          
          return formattedChunks;
        }
        
        // If header chunking didn't produce any chunks, fall through to basic chunking
        console.warn('Header-based chunking produced no chunks, falling back to basic chunking');
      } catch (headerChunkError) {
        console.warn(`Header-based chunking failed: ${headerChunkError.message}, falling back to basic chunking`);
        // Fall through to basic implementation
      }
    } else {
      console.log(`Using basic chunking for non-structured document type: ${fileType}`);
    }

    // Fallback to basic chunking implementation
    console.log(`Using basic text chunking method`);
    const chunks = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      // Calculate end index for this chunk
      let endIndex = Math.min(startIndex + chunkSize, text.length);

      // If we're not at the end of the text, try to find a good breaking point
      if (endIndex < text.length) {
        // Look for paragraph breaks first
        const paragraphBreak = text.lastIndexOf('\n\n', endIndex);
        if (paragraphBreak > startIndex && paragraphBreak > endIndex - 200) {
          endIndex = paragraphBreak + 2; // +2 to include the newlines
        } else {
          // Look for sentence endings (.!?)
          const sentenceMatch = text.substring(endIndex - 100, endIndex + 100).match(/[.!?]\s/);
          if (sentenceMatch) {
            const matchIndex = sentenceMatch.index;
            endIndex = endIndex - 100 + matchIndex + 2; // +2 to include punctuation and space
          } else {
            // Look for a space as last resort
            const lastSpace = text.lastIndexOf(' ', endIndex);
            if (lastSpace > startIndex) {
              endIndex = lastSpace + 1;
            }
          }
        }
      }

      // Extract the chunk
      const chunk = text.substring(startIndex, endIndex).trim();

      // Add to chunks array if not empty
      if (chunk.length > 0) {
        chunks.push({
          text: chunk,
          index: chunks.length,
          length: chunk.length
        });
      }

      // Move to next chunk, accounting for overlap
      startIndex = Math.max(startIndex + 1, endIndex - chunkOverlap);
    }

    console.log(`Custom text chunking created ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * Process images from a PDF document using Docker container
   * @param {Object} document - Document object with file path
   * @param {Object} options - Processing options (userId, sessionId)
   * @returns {Promise<Object>} - Processing result
   */
  async processDocumentImages(document, options = {}) {
    try {
      const { userId, sessionId } = options;

      // Check if image processing is enabled
      const config = require('../utils/config');
      const imageConfig = config.getSection('image_processing') || {};
      const isEnabled = imageConfig.enabled === 'true' || imageConfig.enabled === true;

      if (!isEnabled) {
        console.log('Image processing is disabled in configuration');
        return { success: true, total_count: 0, message: 'Image processing disabled' };
      }

      console.log(`Processing images for document ${document.id}: ${document.original_name}`);

      // Execute image processing using Docker container
      const result = await this.executeImageProcessor(
        document.file_path,
        userId,
        sessionId || 'no_session'
      );

      if (result.success) {
        console.log(`Successfully processed ${result.stats?.processed || result.total_count || 0} images for document ${document.id}`);

        // Store images in ChromaDB if vector store is available and images were processed
        if (this.vectorStoreService && result.images && result.images.length > 0) {
          try {
            console.log(`🗄️ Attempting to store ${result.images.length} images in ChromaDB for document ${document.id}`);
            await this.storeImagesInVectorDB(result.images, document, userId, sessionId);
            console.log(`✅ Successfully stored ${result.images.length} images in vector database`);
          } catch (storeError) {
            console.error(`❌ Failed to store images in vector database: ${storeError.message}`);
            console.error('Store error details:', storeError);
            // Continue even if vector storage fails, but log the error prominently
          }
        } else if (!result.images || result.images.length === 0) {
          console.log(`ℹ️ No images to store for document ${document.id} (${result.stats?.total_found || 0} found, ${result.stats?.processed || 0} processed)`);
        } else if (!this.vectorStoreService) {
          console.warn(`⚠️ Vector store service not available - ${result.images?.length || 0} images will not be stored in ChromaDB`);
        }
      } else {
        console.warn(`Image processing failed for document ${document.id}: ${result.error || 'Unknown error'}`);
      }

      return result;
    } catch (error) {
      console.error(`Error processing images for document ${document.id}:`, error);
      return {
        success: false,
        error: error.message,
        total_count: 0
      };
    }
  }

  /**
   * Execute image processing using Docker container
   * @param {string} filePath - Path to the PDF file
   * @param {string} userId - User ID for isolation
   * @param {string} sessionId - Session ID for context
   * @returns {Promise<Object>} - Processing result
   */
  async executeImageProcessor(filePath, userId, sessionId) {
    return new Promise((resolve, reject) => {
      try {
        const config = require('../utils/config');
        const imageConfig = config.getSection('image_processing') || {};
        const containerName = imageConfig.docker_container || 'productdemo-image-processor';

        // Convert file path to Docker container path
        // Host path: /home/yaswanth/Desktop/c2s_integrate/DATA/documents/...
        // Container path: /app/data/documents/...
        const dockerFilePath = filePath.replace(
          path.resolve(process.cwd(), 'DATA'),
          '/app/data'
        );

        // Prepare the command to execute in Docker container
        const command = [
          'docker', 'compose', 'exec', '-T', 'image-processor',
          'python', 'image-processing/user_isolated_image_processor.py',
          dockerFilePath, userId, '--session-id', sessionId
        ];

        console.log(`Executing image processing: ${command.join(' ')}`);

        const { spawn } = require('child_process');
        const childProcess = spawn(command[0], command.slice(1), {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: path.resolve(process.cwd(), 'Docker'), // Execute from Docker directory
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large JSON output
        });

        let stdout = '';
        let stderr = '';
        let stdoutChunks = [];
        let stderrChunks = [];

        childProcess.stdout.on('data', (data) => {
          stdoutChunks.push(data);
          stdout += data.toString();
        });

        childProcess.stderr.on('data', (data) => {
          stderrChunks.push(data);
          stderr += data.toString();
        });

        childProcess.on('close', (code) => {
          if (code === 0) {
            try {
              console.log('🔍 Raw image processing output:');
              console.log('STDOUT length:', stdout.length);
              console.log('STDERR length:', stderr.length);
              console.log('STDOUT preview (first 500 chars):', stdout.substring(0, 500));
              console.log('STDOUT preview (last 500 chars):', stdout.substring(stdout.length - 500));

              // Extract JSON from stdout - the entire output should be JSON
              let jsonLine = '';

              // First, try to parse the entire stdout as JSON
              try {
                const testParse = JSON.parse(stdout.trim());
                jsonLine = stdout.trim();
                console.log('✅ Entire stdout is valid JSON');
              } catch (e) {
                console.log('❌ Entire stdout is not valid JSON, trying extraction...');

                // Extract JSON from stdout (it might have extra content before/after)
                const lines = stdout.trim().split('\n');

                // Find the line that starts with { and ends with }
                for (const line of lines) {
                  const trimmedLine = line.trim();
                  if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
                    jsonLine = trimmedLine;
                    break;
                  }
                }

                if (!jsonLine) {
                  // If no complete JSON line found, try to parse the last few lines
                  const lastLines = lines.slice(-10).join('\n');
                  const jsonMatch = lastLines.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    jsonLine = jsonMatch[0];
                  }
                }
              }

              // If still no JSON, try to find the start and end of JSON manually
              if (!jsonLine) {
                // Look for the start of the main JSON object - prioritize the beginning
                let startIndex = stdout.indexOf('{\n  "success"');
                if (startIndex === -1) {
                  startIndex = stdout.indexOf('{"success"');
                }
                if (startIndex === -1) {
                  startIndex = stdout.indexOf('{ "success"');
                }

                if (startIndex !== -1) {
                  // Find the matching closing brace by counting braces
                  let braceCount = 0;
                  let endIndex = -1;

                  for (let i = startIndex; i < stdout.length; i++) {
                    if (stdout[i] === '{') {
                      braceCount++;
                    } else if (stdout[i] === '}') {
                      braceCount--;
                      if (braceCount === 0) {
                        endIndex = i;
                        break;
                      }
                    }
                  }

                  if (endIndex !== -1) {
                    jsonLine = stdout.substring(startIndex, endIndex + 1);
                  }
                }
              }

              // If still no JSON found, try to extract from the entire output (fallback)
              if (!jsonLine) {
                // Look for JSON pattern in the entire output
                const fullJsonMatch = stdout.match(/\{[\s\S]*"stats"[\s\S]*\}/);
                if (fullJsonMatch) {
                  jsonLine = fullJsonMatch[0];
                }
              }

              if (!jsonLine) {
                console.error('❌ No valid JSON found in output');
                console.error('Available lines:', lines.slice(0, 5).map((line, i) => `${i}: ${line.substring(0, 100)}...`));
                throw new Error('No valid JSON found in output');
              }

              console.log('📄 Extracted JSON line length:', jsonLine.length);
              console.log('📄 JSON preview:', jsonLine.substring(0, 200) + '...');

              // Parse JSON with better error handling
              let result;
              try {
                result = JSON.parse(jsonLine);
              } catch (parseError) {
                console.error('❌ JSON parse error:', parseError.message);
                console.error('❌ JSON error position:', parseError.message.match(/position (\d+)/)?.[1]);

                // Try to clean the JSON string
                const cleanedJson = jsonLine
                  .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
                  .replace(/\n\s*\n/g, '\n') // Remove empty lines
                  .trim();

                console.log('🧹 Trying with cleaned JSON...');
                result = JSON.parse(cleanedJson);
              }

              console.log('✅ Successfully parsed image processing result');
              console.log(`📊 Result summary: ${result.success ? 'SUCCESS' : 'FAILED'}, ${result.images?.length || 0} images`);

              resolve(result);
            } catch (parseError) {
              console.error('❌ Error parsing image processing result:', parseError);
              console.error('Raw stdout length:', stdout.length);
              console.error('Raw stdout preview:', stdout.substring(0, 500));

              // Try to extract any useful information even if JSON parsing fails
              const imageCountMatch = stdout.match(/processed[:\s]+(\d+)/i);
              const foundCountMatch = stdout.match(/found[:\s]+(\d+)/i);

              resolve({
                success: false,
                error: `Failed to parse result: ${parseError.message}`,
                images: [],
                stats: {
                  processed: imageCountMatch ? parseInt(imageCountMatch[1]) : 0,
                  total_found: foundCountMatch ? parseInt(foundCountMatch[1]) : 0,
                  skipped: 0
                },
                total_count: 0
              });
            }
          } else {
            console.error(`❌ Image processing failed with code ${code}`);
            console.error('Stderr:', stderr);
            resolve({
              success: false,
              error: `Docker command failed with code ${code}\nStderr: ${stderr}`,
              total_count: 0
            });
          }
        });

        childProcess.on('error', (error) => {
          console.error('Error executing image processing:', error);
          reject(error);
        });

      } catch (error) {
        console.error('Error setting up image processing:', error);
        reject(error);
      }
    });
  }

  /**
   * Store extracted images in ChromaDB vector database
   * @param {Array} images - Array of image metadata with base64 data
   * @param {Object} document - Document object
   * @param {string} userId - User ID for isolation
   * @param {string} sessionId - Session ID for context
   * @returns {Promise<void>}
   */
  async storeImagesInVectorDB(images, document, userId, sessionId) {
    try {
      if (!this.vectorStoreService) {
        console.warn('⚠️ Vector store service not available, skipping image storage');
        return;
      }

      console.log(`🗄️ Storing ${images.length} images in ChromaDB for document ${document.id}`);
      console.log(`👤 User: ${userId}, Session: ${sessionId || 'no_session'}`);

      // Get document service for metadata
      const documentService = getDocumentService();
      const docMetadata = await documentService.getDocument(document.id);

      // Log sample image data for debugging
      if (images.length > 0) {
        const sampleImage = images[0];
        console.log(`📸 Sample image data:`, {
          image_id: sampleImage.image_id,
          page: sampleImage.page,
          keywords: sampleImage.keywords?.substring(0, 100) + '...',
          dimensions: sampleImage.dimensions,
          size_kb: sampleImage.size_kb,
          format: sampleImage.format,
          has_base64: !!sampleImage.base64
        });
      }

      // Transform images to the format expected by vector store
      const transformedImages = images.map(image => ({
        image_id: image.image_id,
        page: image.page,
        index: image.index || 0,
        filename: image.filename,
        base64: image.base64,
        keywords: image.keywords || '',
        dimensions: image.dimensions || 'unknown',
        size_kb: image.size_kb || 0,
        format: image.format || 'png'
      }));

      console.log(`🔄 Calling vectorStoreService.addDocumentImages with ${transformedImages.length} images`);

      // Use the specialized addDocumentImages method from vector store service
      const result = await this.vectorStoreService.addDocumentImages(
        document.id,
        transformedImages,
        {
          userId: userId,
          sessionId: sessionId || 'no_session',
          fileName: docMetadata.original_name || document.original_name,
          fileType: docMetadata.file_type || document.file_type
        }
      );

      if (result.success) {
        console.log(`✅ Successfully stored ${result.count} image vectors in ChromaDB`);
      } else {
        console.error(`❌ Failed to store images in vector database: ${result.error}`);
        throw new Error(`Vector storage failed: ${result.error}`);
      }

    } catch (error) {
      console.error('💥 Error storing images in vector database:', error);
      throw error;
    }
  }
}

module.exports = new DocumentProcessor();