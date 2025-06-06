const { Worker } = require('bullmq');
const Redis = require('ioredis');
const winston = require('winston');
const path = require('path');
const config = require('../utils/configParser');

// Import existing document processing services
const DocumentProcessor = require('../services/documentProcessor');
const VectorStoreService = require('../services/vectorStoreService');
const OllamaService = require('../services/ollamaService');
const { getWebSocketService } = require('../services/webSocketService');

class DocumentWorker {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} ${level}: [WORKER] ${message}`;
                })
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'logs/document-worker.log' })
            ]
        });

        // Redis connection configuration
        this.redisConfig = {
            host: process.env.REDIS_HOST || config.redis?.host || 'localhost',
            port: parseInt(process.env.REDIS_PORT || config.redis?.port || '6379'),
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            lazyConnect: true,
            maxRetriesPerRequest: 3
        };

        this.concurrency = parseInt(process.env.DOC_WORKER_CONCURRENCY || config.document_queue?.concurrency || '3');
        this.worker = null;
        this.documentProcessor = null;
        this.vectorStoreService = null;
        this.ollamaService = null;
        this.webSocketService = null;
    }

    async initialize() {
        try {
            this.logger.info('Initializing Document Worker...');

            // Initialize services
            await this.initializeServices();

            // Create BullMQ worker
            this.worker = new Worker('document-processing', this.processDocument.bind(this), {
                connection: new Redis(this.redisConfig),
                concurrency: this.concurrency,
                removeOnComplete: 50,
                removeOnFail: 20,
                stalledInterval: 30 * 1000, // 30 seconds
                maxStalledCount: 1
            });

            // Set up worker event handlers
            this.setupWorkerEvents();

            this.logger.info(`Document Worker initialized with concurrency: ${this.concurrency}`);

        } catch (error) {
            this.logger.error('Failed to initialize Document Worker:', error);
            throw error;
        }
    }

    async initializeServices() {
        try {
            // Initialize VectorStoreService
            this.vectorStoreService = new VectorStoreService();
            await this.vectorStoreService.initialize();
            this.logger.info('VectorStoreService initialized for worker');

            // Initialize OllamaService
            this.ollamaService = new OllamaService();
            await this.ollamaService.initialize();
            this.logger.info('OllamaService initialized for worker');

            // Initialize DocumentProcessor
            this.documentProcessor = new DocumentProcessor(this.vectorStoreService, this.ollamaService);
            this.logger.info('DocumentProcessor initialized for worker');

            // Get WebSocket service for progress updates
            this.webSocketService = await getWebSocketService();
            this.logger.info('WebSocketService connected for worker');

        } catch (error) {
            this.logger.error('Failed to initialize services:', error);
            throw error;
        }
    }

    setupWorkerEvents() {
        this.worker.on('ready', () => {
            this.logger.info('Document Worker is ready to process jobs');
        });

        this.worker.on('active', (job) => {
            this.logger.info(`Processing job ${job.id} for document ${job.data.documentId}`);
        });

        this.worker.on('completed', (job, result) => {
            this.logger.info(`Job ${job.id} completed successfully for document ${job.data.documentId}`);
        });

        this.worker.on('failed', (job, err) => {
            this.logger.error(`Job ${job?.id} failed for document ${job?.data?.documentId}: ${err.message}`);
        });

        this.worker.on('stalled', (jobId) => {
            this.logger.warn(`Job ${jobId} stalled`);
        });

        this.worker.on('error', (err) => {
            this.logger.error('Worker error:', err);
        });
    }

    async processDocument(job) {
        const { documentId, userId, sessionId, filePath, fileName, fileType, processingOptions } = job.data;
        
        try {
            this.logger.info(`Starting document processing for document ${documentId}`);

            // Progress callback function
            const onProgress = async (progress, message, status = 'processing') => {
                try {
                    // Update job progress
                    await job.updateProgress({ progress, message, status });

                    // Broadcast progress to user via WebSocket
                    if (this.webSocketService && userId) {
                        this.webSocketService.emitToUser(userId, 'document-progress', {
                            documentId,
                            progress,
                            message,
                            status,
                            jobId: job.id
                        });
                    }

                    this.logger.info(`Document ${documentId} progress: ${progress}% - ${message}`);
                } catch (error) {
                    this.logger.error('Error updating progress:', error);
                }
            };

            // Start processing
            await onProgress(5, 'Initializing document processing', 'processing');

            // Check if file exists
            const fs = require('fs');
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            await onProgress(10, 'File validated, starting processing', 'processing');

            // Process the document using existing DocumentProcessor
            const result = await this.documentProcessor.processDocument(
                documentId,
                filePath,
                fileName,
                fileType,
                { userId, sessionId, ...processingOptions },
                onProgress
            );

            // Final progress update
            await onProgress(100, 'Document processing completed successfully', 'completed');

            // Broadcast completion to user
            if (this.webSocketService && userId) {
                this.webSocketService.emitToUser(userId, 'document-completed', {
                    documentId,
                    result,
                    jobId: job.id,
                    timestamp: new Date().toISOString()
                });
            }

            this.logger.info(`Document ${documentId} processing completed successfully`);
            
            return {
                documentId,
                chunksProcessed: result.chunksProcessed || 0,
                vectorsStored: result.vectorsStored || 0,
                processingTime: result.processingTime || 0,
                status: 'completed'
            };

        } catch (error) {
            this.logger.error(`Document ${documentId} processing failed:`, error);

            // Update progress with error
            try {
                await job.updateProgress({ 
                    progress: 0, 
                    message: `Processing failed: ${error.message}`, 
                    status: 'failed' 
                });

                // Broadcast failure to user
                if (this.webSocketService && userId) {
                    this.webSocketService.emitToUser(userId, 'document-failed', {
                        documentId,
                        error: error.message,
                        jobId: job.id,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (progressError) {
                this.logger.error('Error updating failure progress:', progressError);
            }

            throw error;
        }
    }

    async shutdown() {
        try {
            this.logger.info('Shutting down Document Worker...');
            
            if (this.worker) {
                await this.worker.close();
                this.logger.info('Document Worker closed successfully');
            }
            
        } catch (error) {
            this.logger.error('Error during worker shutdown:', error);
        }
    }
}

// Initialize and start worker if this file is run directly
if (require.main === module) {
    const worker = new DocumentWorker();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('Received SIGINT, shutting down gracefully...');
        await worker.shutdown();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, shutting down gracefully...');
        await worker.shutdown();
        process.exit(0);
    });

    // Start the worker
    worker.initialize().catch(error => {
        console.error('Failed to start Document Worker:', error);
        process.exit(1);
    });
}

module.exports = DocumentWorker; 