const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const config = require('../utils/config');

class DocumentQueueService {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} ${level}: ${message}`;
                })
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'logs/document-queue.log' })
            ]
        });

        // Redis connection configuration
        this.redisConfig = {
            host: process.env.REDIS_HOST || config.get('redis.host', 'localhost'),
            port: parseInt(process.env.REDIS_PORT || config.get('redis.port', '6379')),
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            lazyConnect: true,
            maxRetriesPerRequest: null
        };

        // Queue configuration
        this.queueConfig = {
            concurrency: parseInt(process.env.DOC_WORKER_CONCURRENCY || config.get('document_queue.concurrency', '3')),
            maxJobs: parseInt(process.env.QUEUE_MAX_JOBS_PER_WORKER || config.get('document_queue.max_jobs_per_worker', '10')),
            retryAttempts: parseInt(process.env.QUEUE_MAX_RETRIES || config.get('document_queue.retry_attempts', '3')),
            removeOnComplete: 50,
            removeOnFail: 20
        };

        this.redis = null;
        this.documentQueue = null;
        this.queueEvents = null;
        this.workers = [];
        this.initialized = false;
        this.progressCallbacks = new Map(); // Store progress callbacks by job ID
    }

    async initialize() {
        try {
            // Initialize Redis connection
            this.redis = new Redis(this.redisConfig);
            
            // Test Redis connection
            await this.redis.ping();
            this.logger.info('Redis connection established successfully');

            // Initialize document processing queue
            this.documentQueue = new Queue('document-processing', {
                connection: this.redis,
                defaultJobOptions: {
                    removeOnComplete: this.queueConfig.removeOnComplete,
                    removeOnFail: this.queueConfig.removeOnFail,
                    attempts: this.queueConfig.retryAttempts,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                }
            });

            // Initialize queue events for monitoring
            this.queueEvents = new QueueEvents('document-processing', {
                connection: this.redis
            });

            this.setupQueueEvents();
            this.initialized = true;
            this.logger.info('Document Queue Service initialized successfully');

        } catch (error) {
            this.logger.error('Failed to initialize Document Queue Service:', error);
            throw error;
        }
    }

    setupQueueEvents() {
        // Job progress events
        this.queueEvents.on('progress', ({ jobId, data }) => {
            this.logger.info(`Job ${jobId} progress: ${data.progress}% - ${data.message}`);
            
            // Call progress callback if registered
            const callback = this.progressCallbacks.get(jobId);
            if (callback) {
                callback(data);
            }
        });

        // Job completion events
        this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
            this.logger.info(`Job ${jobId} completed successfully`);
            this.progressCallbacks.delete(jobId);
        });

        // Job failure events
        this.queueEvents.on('failed', ({ jobId, failedReason }) => {
            this.logger.error(`Job ${jobId} failed: ${failedReason}`);
            this.progressCallbacks.delete(jobId);
        });

        // Job stalled events
        this.queueEvents.on('stalled', ({ jobId }) => {
            this.logger.warn(`Job ${jobId} stalled`);
        });
    }

    /**
     * Add a document processing job to the queue
     */
    async addDocumentJob(documentData, options = {}) {
        if (!this.initialized) {
            throw new Error('Document Queue Service not initialized');
        }

        try {
            const jobId = uuidv4();
            const jobData = {
                documentId: documentData.documentId,
                userId: documentData.userId,
                sessionId: documentData.sessionId,
                filePath: documentData.filePath,
                fileName: documentData.fileName,
                fileType: documentData.fileType,
                processingOptions: documentData.processingOptions || {},
                timestamp: new Date().toISOString()
            };

            const job = await this.documentQueue.add('process-document', jobData, {
                jobId: jobId,
                priority: options.priority || 0,
                delay: options.delay || 0,
                ...options
            });

            this.logger.info(`Document job added to queue: ${job.id} for document ${documentData.documentId}`);
            
            return {
                jobId: job.id,
                documentId: documentData.documentId,
                queuePosition: await this.getQueuePosition(job.id)
            };

        } catch (error) {
            this.logger.error('Failed to add document job to queue:', error);
            throw error;
        }
    }

    /**
     * Register a progress callback for a specific job
     */
    registerProgressCallback(jobId, callback) {
        this.progressCallbacks.set(jobId, callback);
    }

    /**
     * Get current queue position for a job
     */
    async getQueuePosition(jobId) {
        try {
            const job = await this.documentQueue.getJob(jobId);
            if (!job) return -1;

            const waiting = await this.documentQueue.getWaiting();
            const index = waiting.findIndex(waitingJob => waitingJob.id === jobId);
            
            return index >= 0 ? index + 1 : 0;
        } catch (error) {
            this.logger.error('Error getting queue position:', error);
            return -1;
        }
    }

    /**
     * Get user's processing status
     */
    async getUserProcessingStatus(userId) {
        try {
            const [waiting, active, completed, failed] = await Promise.all([
                this.documentQueue.getWaiting(),
                this.documentQueue.getActive(),
                this.documentQueue.getCompleted(),
                this.documentQueue.getFailed()
            ]);

            const userJobs = {
                waiting: waiting.filter(job => job.data.userId === userId),
                active: active.filter(job => job.data.userId === userId),
                completed: completed.filter(job => job.data.userId === userId).slice(0, 10),
                failed: failed.filter(job => job.data.userId === userId).slice(0, 5)
            };

            return {
                summary: {
                    waiting: userJobs.waiting.length,
                    active: userJobs.active.length,
                    completed: userJobs.completed.length,
                    failed: userJobs.failed.length
                },
                jobs: userJobs
            };

        } catch (error) {
            this.logger.error('Error getting user processing status:', error);
            throw error;
        }
    }

    /**
     * Cancel a document processing job
     */
    async cancelDocumentProcessing(jobId, userId) {
        try {
            const job = await this.documentQueue.getJob(jobId);
            
            if (!job) {
                throw new Error('Job not found');
            }

            if (job.data.userId !== userId) {
                throw new Error('Unauthorized to cancel this job');
            }

            await job.remove();
            this.progressCallbacks.delete(jobId);
            
            this.logger.info(`Document processing job ${jobId} cancelled by user ${userId}`);
            return true;

        } catch (error) {
            this.logger.error('Error cancelling document processing:', error);
            throw error;
        }
    }

    /**
     * Get queue metrics
     */
    async getQueueMetrics() {
        try {
            const [waiting, active, completed, failed, delayed] = await Promise.all([
                this.documentQueue.getWaiting(),
                this.documentQueue.getActive(),
                this.documentQueue.getCompleted(),
                this.documentQueue.getFailed(),
                this.documentQueue.getDelayed()
            ]);

            return {
                counts: {
                    waiting: waiting.length,
                    active: active.length,
                    completed: completed.length,
                    failed: failed.length,
                    delayed: delayed.length
                },
                workers: {
                    count: this.workers.length,
                    concurrency: this.queueConfig.concurrency
                },
                configuration: this.queueConfig
            };

        } catch (error) {
            this.logger.error('Error getting queue metrics:', error);
            throw error;
        }
    }

    /**
     * Clean completed jobs
     */
    async cleanQueue(grace = 3600000) { // 1 hour default
        try {
            await this.documentQueue.clean(grace, 'completed');
            await this.documentQueue.clean(grace, 'failed');
            this.logger.info('Queue cleaned successfully');
        } catch (error) {
            this.logger.error('Error cleaning queue:', error);
            throw error;
        }
    }

    /**
     * Retry failed job
     */
    async retryFailedJob(jobId) {
        try {
            const job = await this.documentQueue.getJob(jobId);
            if (!job) {
                throw new Error('Job not found');
            }

            await job.retry();
            this.logger.info(`Job ${jobId} retried successfully`);
            return true;

        } catch (error) {
            this.logger.error('Error retrying job:', error);
            throw error;
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        try {
            if (this.queueEvents) {
                await this.queueEvents.close();
            }

            if (this.workers.length > 0) {
                await Promise.all(this.workers.map(worker => worker.close()));
            }

            if (this.documentQueue) {
                await this.documentQueue.close();
            }

            if (this.redis) {
                this.redis.disconnect();
            }

            this.logger.info('Document Queue Service shutdown completed');

        } catch (error) {
            this.logger.error('Error during shutdown:', error);
        }
    }
}

// Singleton instance
let queueService = null;

const getDocumentQueueService = async () => {
    if (!queueService) {
        queueService = new DocumentQueueService();
        await queueService.initialize();
    }
    return queueService;
};

module.exports = {
    DocumentQueueService,
    getDocumentQueueService
}; 