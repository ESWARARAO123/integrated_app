#!/usr/bin/env node

/**
 * Manual cleanup script for processed document files
 * Supports Windows, Linux, and macOS
 * 
 * Usage:
 *   node src/scripts/cleanup-processed-files.js [options]
 * 
 * Options:
 *   --days=N          Clean files older than N days (default: 7)
 *   --user-id=UUID    Clean files for specific user only
 *   --failed-only     Clean only files from failed processing
 *   --dry-run         Show what would be deleted without actually deleting
 *   --force           Skip confirmation prompts
 *   --help            Show this help message
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const winston = require('winston');
const config = require('../utils/config');
const FileCleanupService = require('../services/fileCleanupService');

class ProcessedFilesCleaner {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${level.toUpperCase()}] [FilesCleaner] ${message} ${metaStr}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: path.join(process.cwd(), 'logs', 'manual-cleanup.log'),
          maxsize: 5 * 1024 * 1024, // 5MB
          maxFiles: 3
        })
      ]
    });

    this.fileCleanupService = new FileCleanupService();
    this.dbPool = null;
  }

  /**
   * Initialize database connection
   */
  async initDatabase() {
    try {
      const dbConfig = {
        host: config.get('database.database-host'),
        port: config.get('database.database-port'),
        database: config.get('database.database-name'),
        user: config.get('database.database-user'),
        password: config.get('database.database-password'),
        ssl: config.get('database.ssl') === 'true' ? { rejectUnauthorized: false } : false
      };

      this.dbPool = new Pool(dbConfig);
      await this.dbPool.query('SELECT 1'); // Test connection
      this.logger.info('Database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to database:', error.message);
      throw error;
    }
  }

  /**
   * Get processed documents from database
   */
  async getProcessedDocuments(options = {}) {
    const { userId, failedOnly, maxAgeDays } = options;
    
    let query = `
      SELECT id, user_id, original_name, file_path, file_size, status, 
             created_at, updated_at, session_id
      FROM documents 
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Filter by user ID
    if (userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    // Filter by status
    if (failedOnly) {
      query += ` AND status IN ('failed', 'error')`;
    } else {
      query += ` AND status IN ('completed', 'processed', 'failed', 'error')`;
    }

    // Filter by age
    if (maxAgeDays) {
      query += ` AND updated_at < NOW() - INTERVAL '${maxAgeDays} days'`;
    }

    query += ` ORDER BY updated_at ASC`;

    try {
      const result = await this.dbPool.query(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to query processed documents:', error.message);
      throw error;
    }
  }

  /**
   * Check if file exists and get its stats
   */
  async getFileInfo(filePath) {
    try {
      // Normalize path for cross-platform compatibility
      const normalizedPath = path.resolve(filePath);
      
      // Check if file exists
      await fs.access(normalizedPath);
      const stats = await fs.stat(normalizedPath);
      
      return {
        exists: true,
        path: normalizedPath,
        size: stats.size,
        sizeKB: Math.round(stats.size / 1024),
        sizeMB: Math.round(stats.size / (1024 * 1024)),
        modified: stats.mtime,
        age: Math.floor((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)) // days
      };
    } catch (error) {
      return {
        exists: false,
        path: filePath,
        error: error.message
      };
    }
  }

  /**
   * Clean up files based on criteria
   */
  async cleanupFiles(options = {}) {
    const { 
      maxAgeDays = 7, 
      userId = null, 
      failedOnly = false, 
      dryRun = false,
      force = false 
    } = options;

    this.logger.info('Starting file cleanup', { 
      maxAgeDays, 
      userId, 
      failedOnly, 
      dryRun, 
      force 
    });

    // Get processed documents from database
    const documents = await this.getProcessedDocuments({ 
      userId, 
      failedOnly, 
      maxAgeDays 
    });

    this.logger.info(`Found ${documents.length} documents to process`);

    if (documents.length === 0) {
      this.logger.info('No documents found matching criteria');
      return { processed: 0, deleted: 0, errors: 0, totalSpaceFreed: 0 };
    }

    // Analyze files
    const fileAnalysis = [];
    let totalSize = 0;
    let existingFiles = 0;

    for (const doc of documents) {
      const fileInfo = await this.getFileInfo(doc.file_path);
      
      if (fileInfo.exists) {
        existingFiles++;
        totalSize += fileInfo.size;
        fileAnalysis.push({
          document: doc,
          fileInfo
        });
      } else {
        this.logger.debug(`File not found: ${doc.file_path}`, { documentId: doc.id });
      }
    }

    this.logger.info(`Analysis complete: ${existingFiles} files exist, total size: ${Math.round(totalSize / (1024 * 1024))}MB`);

    if (existingFiles === 0) {
      this.logger.info('No files found to clean up');
      return { processed: documents.length, deleted: 0, errors: 0, totalSpaceFreed: 0 };
    }

    // Show summary and ask for confirmation (unless force mode)
    if (!force && !dryRun) {
      console.log('\n📋 Cleanup Summary:');
      console.log(`   Documents found: ${documents.length}`);
      console.log(`   Files to delete: ${existingFiles}`);
      console.log(`   Total size: ${Math.round(totalSize / (1024 * 1024))}MB`);
      console.log(`   Criteria: ${failedOnly ? 'Failed only' : 'All processed'}, older than ${maxAgeDays} days`);
      
      if (userId) {
        console.log(`   User filter: ${userId}`);
      }

      // Simple confirmation (in a real implementation, you might use readline)
      console.log('\n⚠️  This will permanently delete the files listed above.');
      console.log('   To proceed, run with --force flag or use --dry-run to see what would be deleted.');
      return { processed: 0, deleted: 0, errors: 0, totalSpaceFreed: 0, cancelled: true };
    }

    // Perform cleanup
    let deleted = 0;
    let errors = 0;
    let totalSpaceFreed = 0;

    for (const { document, fileInfo } of fileAnalysis) {
      try {
        if (dryRun) {
          this.logger.info(`[DRY RUN] Would delete: ${fileInfo.path}`, {
            documentId: document.id,
            sizeKB: fileInfo.sizeKB,
            age: fileInfo.age
          });
          deleted++;
          totalSpaceFreed += fileInfo.size;
        } else {
          // Use the file cleanup service for actual deletion
          const result = await this.fileCleanupService.cleanupNow(fileInfo.path);
          
          if (result[0]?.success) {
            this.logger.info(`Deleted file: ${fileInfo.path}`, {
              documentId: document.id,
              sizeKB: fileInfo.sizeKB,
              age: fileInfo.age
            });
            deleted++;
            totalSpaceFreed += fileInfo.size;
          } else {
            this.logger.error(`Failed to delete file: ${fileInfo.path}`, {
              documentId: document.id,
              error: result[0]?.error
            });
            errors++;
          }
        }
      } catch (error) {
        this.logger.error(`Error processing file: ${fileInfo.path}`, {
          documentId: document.id,
          error: error.message
        });
        errors++;
      }
    }

    const summary = {
      processed: documents.length,
      deleted,
      errors,
      totalSpaceFreed,
      totalSpaceFreedMB: Math.round(totalSpaceFreed / (1024 * 1024))
    };

    this.logger.info(`Cleanup completed`, summary);
    return summary;
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.dbPool) {
      await this.dbPool.end();
      this.logger.info('Database connection closed');
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    maxAgeDays: 7,
    userId: null,
    failedOnly: false,
    dryRun: false,
    force: false,
    help: false
  };

  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      options.maxAgeDays = parseInt(arg.split('=')[1]) || 7;
    } else if (arg.startsWith('--user-id=')) {
      options.userId = arg.split('=')[1];
    } else if (arg === '--failed-only') {
      options.failedOnly = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--help') {
      options.help = true;
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
🗑️  Manual File Cleanup Script

Usage: node src/scripts/cleanup-processed-files.js [options]

Options:
  --days=N          Clean files older than N days (default: 7)
  --user-id=UUID    Clean files for specific user only
  --failed-only     Clean only files from failed processing
  --dry-run         Show what would be deleted without actually deleting
  --force           Skip confirmation prompts
  --help            Show this help message

Examples:
  # Dry run - see what would be deleted
  node src/scripts/cleanup-processed-files.js --dry-run

  # Clean files older than 30 days
  node src/scripts/cleanup-processed-files.js --days=30 --force

  # Clean only failed processing files
  node src/scripts/cleanup-processed-files.js --failed-only --force

  # Clean specific user's files
  node src/scripts/cleanup-processed-files.js --user-id=12345678-1234-1234-1234-123456789012 --force

Cross-platform compatible: Works on Windows, Linux, and macOS.
  `);
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  const cleaner = new ProcessedFilesCleaner();

  try {
    await cleaner.initDatabase();
    const result = await cleaner.cleanupFiles(options);
    
    console.log('\n✅ Cleanup Summary:');
    console.log(`   Documents processed: ${result.processed}`);
    console.log(`   Files deleted: ${result.deleted}`);
    console.log(`   Errors: ${result.errors}`);
    console.log(`   Space freed: ${result.totalSpaceFreedMB}MB`);
    
    if (result.cancelled) {
      console.log('   Status: Cancelled (use --force to proceed)');
    } else if (options.dryRun) {
      console.log('   Status: Dry run completed (use --force to actually delete)');
    } else {
      console.log('   Status: Completed successfully');
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  } finally {
    await cleaner.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ProcessedFilesCleaner;
