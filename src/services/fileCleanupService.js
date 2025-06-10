const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');
const config = require('../utils/config');

/**
 * Cross-platform file cleanup service for automatic deletion of processed documents
 * Handles Windows, Linux, and macOS file systems safely
 */
class FileCleanupService {
  constructor() {
    this.logger = winston.createLogger({
      level: this.getCleanupLogLevel(),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${level.toUpperCase()}] [FileCleanup] ${message} ${metaStr}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: path.join(process.cwd(), 'logs', 'file-cleanup.log'),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        })
      ]
    });

    // Configuration
    this.config = {
      autoCleanup: this.getConfigValue('auto_cleanup_files', true),
      cleanupDelay: this.getConfigValue('cleanup_delay_seconds', 30) * 1000, // Convert to ms
      keepFailedFiles: this.getConfigValue('keep_failed_files', true),
      maxRetries: 3,
      retryDelay: 1000 // 1 second
    };

    this.logger.info('FileCleanupService initialized', this.config);
  }

  /**
   * Get configuration value with fallback
   */
  getConfigValue(key, defaultValue) {
    try {
      const configSection = config.get('document_processing') || {};
      return configSection[key] !== undefined ? configSection[key] : defaultValue;
    } catch (error) {
      this.logger.warn(`Failed to get config value for ${key}, using default: ${defaultValue}`);
      return defaultValue;
    }
  }

  /**
   * Get cleanup log level from config
   */
  getCleanupLogLevel() {
    try {
      const configSection = config.get('document_processing') || {};
      return configSection.cleanup_log_level || 'info';
    } catch (error) {
      return 'info';
    }
  }

  /**
   * Schedule automatic cleanup of a processed document file
   * @param {string} filePath - Full path to the file to be cleaned up
   * @param {Object} documentInfo - Document metadata for logging
   * @param {boolean} processingSuccessful - Whether processing was successful
   */
  async scheduleCleanup(filePath, documentInfo = {}, processingSuccessful = true) {
    if (!this.config.autoCleanup) {
      this.logger.debug('Auto cleanup disabled, skipping file cleanup', { filePath });
      return { scheduled: false, reason: 'auto_cleanup_disabled' };
    }

    if (!processingSuccessful && this.config.keepFailedFiles) {
      this.logger.info('Keeping file due to processing failure', { 
        filePath, 
        documentId: documentInfo.id 
      });
      return { scheduled: false, reason: 'processing_failed' };
    }

    try {
      // Validate file path
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path provided');
      }

      // Normalize path for cross-platform compatibility
      const normalizedPath = path.resolve(filePath);
      
      // Security check - ensure file is in documents directory
      const documentsDir = path.resolve(process.cwd(), 'DATA', 'documents');
      if (!normalizedPath.startsWith(documentsDir)) {
        throw new Error('File path outside allowed documents directory');
      }

      // Check if file exists before scheduling cleanup
      try {
        await fs.access(normalizedPath);
      } catch (accessError) {
        this.logger.warn('File does not exist, skipping cleanup', { 
          filePath: normalizedPath,
          error: accessError.message 
        });
        return { scheduled: false, reason: 'file_not_found' };
      }

      this.logger.info('Scheduling file cleanup', {
        filePath: normalizedPath,
        documentId: documentInfo.id,
        documentName: documentInfo.original_name,
        delayMs: this.config.cleanupDelay,
        processingSuccessful
      });

      // Schedule cleanup with delay
      setTimeout(async () => {
        await this.performCleanup(normalizedPath, documentInfo);
      }, this.config.cleanupDelay);

      return { 
        scheduled: true, 
        delayMs: this.config.cleanupDelay,
        filePath: normalizedPath 
      };

    } catch (error) {
      this.logger.error('Failed to schedule file cleanup', {
        filePath,
        documentId: documentInfo.id,
        error: error.message,
        stack: error.stack
      });
      return { scheduled: false, reason: 'scheduling_error', error: error.message };
    }
  }

  /**
   * Perform the actual file cleanup with retry logic
   * @param {string} filePath - Full path to the file to be deleted
   * @param {Object} documentInfo - Document metadata for logging
   */
  async performCleanup(filePath, documentInfo = {}) {
    let attempt = 0;
    
    while (attempt < this.config.maxRetries) {
      attempt++;
      
      try {
        // Check if file still exists
        try {
          await fs.access(filePath);
        } catch (accessError) {
          this.logger.info('File already deleted or moved, cleanup not needed', {
            filePath,
            documentId: documentInfo.id,
            attempt
          });
          return { success: true, reason: 'file_already_gone' };
        }

        // Get file stats for logging
        const stats = await fs.stat(filePath);
        const fileSizeKB = Math.round(stats.size / 1024);

        // Perform deletion
        await fs.unlink(filePath);

        this.logger.info('File cleanup completed successfully', {
          filePath,
          documentId: documentInfo.id,
          documentName: documentInfo.original_name,
          fileSizeKB,
          attempt,
          freedSpaceKB: fileSizeKB
        });

        return { 
          success: true, 
          fileSizeKB, 
          attempt,
          freedSpaceKB: fileSizeKB 
        };

      } catch (error) {
        this.logger.warn(`File cleanup attempt ${attempt} failed`, {
          filePath,
          documentId: documentInfo.id,
          error: error.message,
          errorCode: error.code,
          attempt,
          maxRetries: this.config.maxRetries
        });

        // If this was the last attempt, log as error
        if (attempt >= this.config.maxRetries) {
          this.logger.error('File cleanup failed after all retries', {
            filePath,
            documentId: documentInfo.id,
            error: error.message,
            errorCode: error.code,
            totalAttempts: attempt
          });
          return { 
            success: false, 
            error: error.message, 
            errorCode: error.code,
            totalAttempts: attempt 
          };
        }

        // Wait before retry (exponential backoff)
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Clean up files immediately (for manual cleanup operations)
   * @param {string|Array} filePaths - File path(s) to clean up
   * @param {Object} options - Cleanup options
   */
  async cleanupNow(filePaths, options = {}) {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    const results = [];

    for (const filePath of paths) {
      try {
        const normalizedPath = path.resolve(filePath);
        
        // Security check
        const documentsDir = path.resolve(process.cwd(), 'DATA', 'documents');
        if (!normalizedPath.startsWith(documentsDir)) {
          results.push({
            filePath: normalizedPath,
            success: false,
            error: 'File path outside allowed directory'
          });
          continue;
        }

        const result = await this.performCleanup(normalizedPath, { 
          id: 'manual_cleanup',
          original_name: path.basename(normalizedPath)
        });
        
        results.push({
          filePath: normalizedPath,
          ...result
        });

      } catch (error) {
        results.push({
          filePath,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    try {
      const logFile = path.join(process.cwd(), 'logs', 'file-cleanup.log');
      
      try {
        await fs.access(logFile);
      } catch (accessError) {
        return {
          totalCleanups: 0,
          totalSpaceFreed: 0,
          lastCleanup: null,
          errors: 0
        };
      }

      // This is a simplified version - in production you might want to use a proper log parser
      const logContent = await fs.readFile(logFile, 'utf8');
      const lines = logContent.split('\n');
      
      let totalCleanups = 0;
      let totalSpaceFreed = 0;
      let errors = 0;
      let lastCleanup = null;

      for (const line of lines) {
        if (line.includes('File cleanup completed successfully')) {
          totalCleanups++;
          const match = line.match(/"freedSpaceKB":(\d+)/);
          if (match) {
            totalSpaceFreed += parseInt(match[1]);
          }
          // Extract timestamp
          const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
          if (timestampMatch) {
            lastCleanup = timestampMatch[1];
          }
        } else if (line.includes('File cleanup failed after all retries')) {
          errors++;
        }
      }

      return {
        totalCleanups,
        totalSpaceFreedKB: totalSpaceFreed,
        totalSpaceFreedMB: Math.round(totalSpaceFreed / 1024),
        lastCleanup,
        errors,
        configEnabled: this.config.autoCleanup
      };

    } catch (error) {
      this.logger.error('Failed to get cleanup stats', { error: error.message });
      return {
        error: error.message,
        configEnabled: this.config.autoCleanup
      };
    }
  }
}

module.exports = FileCleanupService;
