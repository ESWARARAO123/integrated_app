const fs = require('fs');
const path = require('path');
const { pool } = require('../database');
const { loadPathsFromConfig, ensureDirectoriesExist } = require('../utils/pathConfig');
const { getDocumentQueueService } = require('./documentQueueService');
const { getWebSocketService } = require('./webSocketService');
// Don't require documentProcessor here to avoid circular dependency
// We'll require it only when needed in specific methods

class DocumentService {
  constructor() {
    // Load paths from config and ensure directories exist
    const paths = loadPathsFromConfig();
    ensureDirectoriesExist(paths);

    // Set document directory from config
    this.documentsDir = paths.documentsDir;
    this.queueService = null;
    this.webSocketService = null;
  }

  /**
   * Initialize services (called when services are available)
   */
  async initializeServices() {
    try {
      this.queueService = await getDocumentQueueService();
      this.webSocketService = getWebSocketService();
    } catch (error) {
      console.error('Error initializing document service dependencies:', error);
    }
  }

  /**
   * Get user's document directory, create if it doesn't exist
   * @param {string} userId - User ID
   * @returns {string} - Path to user's document directory
   */
  getUserDocumentDir(userId) {
    const userDir = path.join(this.documentsDir, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    return userDir;
  }

  /**
   * Save document metadata to database
   * @param {Object} document - Document metadata
   * @param {boolean} processDocument - Whether to trigger document processing
   * @returns {Promise<Object>} - Saved document with ID
   */
  async saveDocument(document, processDocument = false) {
    const { userId, filename, originalName, filePath, fileType, fileSize, collectionId } = document;

    try {
      const result = await pool.query(
        'INSERT INTO documents (user_id, filename, original_name, file_path, file_type, file_size, collection_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, status, created_at',
        [userId, filename, originalName, filePath, fileType, fileSize, collectionId, 'UPLOADED']
      );

      const savedDocument = {
        id: result.rows[0].id,
        userId,
        filename,
        originalName,
        filePath,
        fileType,
        fileSize,
        collectionId,
        status: result.rows[0].status,
        createdAt: result.rows[0].created_at
      };

      // Trigger document processing if requested
      if (processDocument) {
        // We'll do this asynchronously so it doesn't block the response
        this.triggerDocumentProcessing(savedDocument.id).catch(error => {
          console.error(`Error triggering processing for document ${savedDocument.id}:`, error);
        });
      }

      return savedDocument;
    } catch (error) {
      console.error('Error saving document to database:', error);
      throw new Error('Failed to save document metadata');
    }
  }

  /**
   * Trigger document processing (Updated for queue-based processing)
   * @param {number} documentId - Document ID
   * @returns {Promise<void>}
   */
  async triggerDocumentProcessing(documentId) {
    try {
      // Get the document from the database
      const document = await this.getDocument(documentId);

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      console.log(`Triggering async processing for document ${documentId}`);

      // Use async queue-based processing instead of blocking
      const result = await this.processDocumentAsync(documentId, {
        userId: document.user_id,
        sessionId: document.session_id || null
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to queue document for processing');
      }

      console.log(`Document ${documentId} queued successfully with job ID: ${result.jobId}`);

    } catch (error) {
      console.error(`Error triggering processing for document ${documentId}:`, error);
      // Update document status to ERROR
      await this.updateDocumentQueueStatus(
        documentId,
        'failed',
        error.message || 'Unknown error during processing trigger'
      );
      throw error;
    }
  }

  /**
   * Get document by ID
   * @param {number} id - Document ID
   * @param {string} [userId] - Optional User ID (for authorization)
   * @returns {Promise<Object>} - Document metadata
   */
  async getDocument(id, userId = null) {
    try {
      let query, params;

      if (userId) {
        // If userId is provided, use it for authorization
        query = 'SELECT * FROM documents WHERE id = $1 AND user_id = $2';
        params = [id, userId];
      } else {
        // If no userId, just get the document by ID (for internal use)
        query = 'SELECT * FROM documents WHERE id = $1';
        params = [id];
      }

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        throw new Error('Document not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }

  /**
   * Get all documents for a user
   * @param {string} userId - User ID
   * @param {string} collectionId - Optional collection ID to filter by
   * @returns {Promise<Array>} - Array of document metadata
   */
  async getUserDocuments(userId, collectionId = null) {
    try {
      let query = 'SELECT * FROM documents WHERE user_id = $1';
      let params = [userId];

      if (collectionId) {
        query += ' AND collection_id = $2';
        params.push(collectionId);
      }

      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting user documents:', error);
      throw error;
    }
  }

  /**
   * Update document status
   * @param {number} id - Document ID
   * @param {string} status - New status
   * @param {string} errorMessage - Optional error message
   * @param {boolean} isLongRunning - Whether this is a long-running process that needs to keep the session alive
   * @returns {Promise<Object>} - Updated document
   */
  async updateDocumentStatus(id, status, errorMessage = null, isLongRunning = false) {
    try {
      let query = 'UPDATE documents SET status = $1, updated_at = NOW()';
      let params = [status];

      if (errorMessage) {
        query += ', processing_error = $2';
        params.push(errorMessage);
      }

      query += ' WHERE id = $' + (params.length + 1) + ' RETURNING *';
      params.push(id);

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        throw new Error('Document not found');
      }

      // If this is a long-running process, update a timestamp to help keep the session alive
      if (isLongRunning) {
        // Update a last_active timestamp in the document record
        // This database activity helps prevent session timeouts during long-running processes
        try {
          await pool.query(
            'UPDATE documents SET last_activity_timestamp = NOW() WHERE id = $1',
            [id]
          );
        } catch (error) {
          // Don't fail the main operation if this fails
          console.warn(`Failed to update last_activity_timestamp for document ${id}:`, error.message);
        }
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error updating document status:', error);
      throw error;
    }
  }

  /**
   * Delete document
   * @param {number} id - Document ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} - Success status
   */
  async deleteDocument(id, userId) {
    try {
      // Get document info first
      const document = await this.getDocument(id, userId);

      // Delete from database
      await pool.query('DELETE FROM documents WHERE id = $1', [id]);

      // Delete file if it exists
      if (fs.existsSync(document.file_path)) {
        fs.unlinkSync(document.file_path);
      }

      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Process document for vector storage and RAG (DEPRECATED - Use processDocumentAsync)
   * @param {string} documentId - Document ID
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Processing result
   */
  async processDocument(documentId, options = {}) {
    console.warn('DocumentService.processDocument is deprecated. Use processDocumentAsync for queue-based processing.');
    return this.processDocumentAsync(documentId, options);
  }

  /**
   * Process document asynchronously using queue system
   * @param {string} documentId - Document ID
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Queue job information
   */
  async processDocumentAsync(documentId, options = {}) {
    try {
      const { userId, sessionId, priority = 0 } = options;

      // Initialize services if not done yet
      if (!this.queueService) {
        await this.initializeServices();
      }

      // Get document from database
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Update document status to queued
      await this.updateDocumentQueueStatus(documentId, 'queued', null, new Date());

      console.log(`Queuing document ${documentId} for async processing with options:`, {
        userId: userId || document.user_id,
        sessionId: sessionId || document.session_id || null,
        priority
      });

      // Prepare job data
      const jobData = {
        documentId: parseInt(documentId),
        userId: userId || document.user_id,
        sessionId: sessionId || document.session_id || null,
        filePath: document.file_path,
        fileName: document.original_name || document.filename,
        fileType: document.file_type,
        processingOptions: {
          ...options,
          documentRecordId: document.id
        }
      };

      // Add job to queue
      const queueResult = await this.queueService.addDocumentJob(jobData, {
        priority,
        delay: options.delay || 0
      });

      // Update document with job ID
      await this.updateDocumentWithJobId(documentId, queueResult.jobId);

      // Send initial queue status to user
      if (this.webSocketService && jobData.userId) {
        this.webSocketService.emitToUser(jobData.userId, 'document-queued', {
          documentId: parseInt(documentId),
          jobId: queueResult.jobId,
          queuePosition: queueResult.queuePosition,
          message: 'Document queued for processing',
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: true,
        jobId: queueResult.jobId,
        documentId: parseInt(documentId),
        queuePosition: queueResult.queuePosition,
        status: 'queued',
        message: 'Document queued for processing'
      };

    } catch (error) {
      console.error(`Error queuing document ${documentId} for processing:`, error);
      
      // Update document status to failed
      await this.updateDocumentQueueStatus(documentId, 'failed', error.message);

      return {
        success: false,
        error: error.message,
        documentId: parseInt(documentId),
        status: 'failed'
      };
    }
  }

  /**
   * Get user's processing status from queue
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User's queue status
   */
  async getUserProcessingStatus(userId) {
    try {
      // Initialize services if not done yet
      if (!this.queueService) {
        await this.initializeServices();
      }

      const queueStatus = await this.queueService.getUserProcessingStatus(userId);
      
      // Get additional info from database
      const dbQuery = `
        SELECT 
          queue_status,
          COUNT(*) as count
        FROM documents 
        WHERE user_id = $1 
        GROUP BY queue_status
      `;
      
      const dbResult = await pool.query(dbQuery, [userId]);
      const dbCounts = {};
      dbResult.rows.forEach(row => {
        dbCounts[row.queue_status] = parseInt(row.count);
      });

      return {
        queue: queueStatus.summary,
        database: dbCounts,
        jobs: {
          active: queueStatus.jobs.active.map(job => ({
            jobId: job.id,
            documentId: job.data.documentId,
            fileName: job.data.fileName,
            progress: job.progress || 0
          })),
          waiting: queueStatus.jobs.waiting.map(job => ({
            jobId: job.id,
            documentId: job.data.documentId,
            fileName: job.data.fileName,
            queuePosition: job.opts.priority || 0
          }))
        }
      };

    } catch (error) {
      console.error(`Error getting processing status for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel document processing
   * @param {string} documentId - Document ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} - Success status
   */
  async cancelDocumentProcessing(documentId, userId) {
    try {
      // Initialize services if not done yet
      if (!this.queueService) {
        await this.initializeServices();
      }

      // Get document to find job ID
      const document = await this.getDocument(documentId, userId);
      if (!document) {
        throw new Error('Document not found or unauthorized');
      }

      if (!document.job_id) {
        throw new Error('Document is not in the processing queue');
      }

      // Cancel the job
      const cancelled = await this.queueService.cancelDocumentProcessing(document.job_id, userId);

      if (cancelled) {
        // Update document status
        await this.updateDocumentQueueStatus(documentId, 'cancelled', 'Processing cancelled by user');

        // Notify user
        if (this.webSocketService) {
          this.webSocketService.emitToUser(userId, 'document-cancelled', {
            documentId: parseInt(documentId),
            jobId: document.job_id,
            message: 'Document processing cancelled',
            timestamp: new Date().toISOString()
          });
        }
      }

      return cancelled;

    } catch (error) {
      console.error(`Error cancelling document processing for ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Update document queue status in database
   * @param {number} documentId - Document ID
   * @param {string} queueStatus - New queue status
   * @param {string} errorMessage - Optional error message
   * @param {Date} queuedAt - Optional queued timestamp
   * @returns {Promise<Object>} - Updated document
   */
  async updateDocumentQueueStatus(documentId, queueStatus, errorMessage = null, queuedAt = null) {
    try {
      let query = 'UPDATE documents SET queue_status = $1, updated_at = NOW()';
      let params = [queueStatus];

      if (errorMessage) {
        query += ', error_message = $2';
        params.push(errorMessage);
      }

      if (queuedAt) {
        query += `, queued_at = $${params.length + 1}`;
        params.push(queuedAt);
      }

      // Set processing timestamps based on status
      if (queueStatus === 'processing') {
        query += `, processing_started_at = NOW()`;
      } else if (queueStatus === 'completed') {
        query += `, processing_completed_at = NOW()`;
      }

      query += ` WHERE id = $${params.length + 1} RETURNING *`;
      params.push(documentId);

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        throw new Error('Document not found');
      }

      return result.rows[0];

    } catch (error) {
      console.error('Error updating document queue status:', error);
      throw error;
    }
  }

  /**
   * Update document with job ID
   * @param {number} documentId - Document ID
   * @param {string} jobId - Queue job ID
   * @returns {Promise<Object>} - Updated document
   */
  async updateDocumentWithJobId(documentId, jobId) {
    try {
      const result = await pool.query(
        'UPDATE documents SET job_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [jobId, documentId]
      );

      if (result.rows.length === 0) {
        throw new Error('Document not found');
      }

      return result.rows[0];

    } catch (error) {
      console.error('Error updating document with job ID:', error);
      throw error;
    }
  }

  /**
   * Create a new document in the database
   * @param {Object} documentData - Document data
   * @returns {Promise<Object>} - The created document
   */
  async createDocument(documentData) {
    const {
      user_id,
      original_name,
      file_path,
      file_type,
      file_size,
      mime_type,
      collection_id = null,
      status = 'pending',
      session_id = null,
      filename = null
    } = documentData;

    console.log(`Creating document record: ${original_name} for user ${user_id}${session_id ? `, session ${session_id}` : ''}`);

    // Validate required fields
    if (!user_id || !original_name || !file_path) {
      throw new Error('Missing required document data: user_id, original_name, and file_path are required');
    }

    // Generate a filename if not provided
    const generatedFilename = filename || path.basename(file_path) || original_name;

    try {
      const query = `
        INSERT INTO documents
        (user_id, original_name, file_path, file_type, file_size, mime_type, collection_id, status, session_id, filename)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const params = [
        user_id,
        original_name,
        file_path,
        file_type,
        file_size,
        mime_type,
        collection_id,
        status,
        session_id,
        generatedFilename
      ];

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        throw new Error('Failed to create document record');
      }

      console.log(`Document created successfully with ID: ${result.rows[0].id}`);

      return result.rows[0];
    } catch (error) {
      console.error('Error creating document in database:', error);
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }
}

module.exports = new DocumentService();
