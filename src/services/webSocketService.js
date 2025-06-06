const winston = require('winston');

class WebSocketService {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} ${level}: [WEBSOCKET] ${message}`;
                })
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'logs/websocket.log' })
            ]
        });

        this.wsServer = null;
        this.initialized = false;
    }

    /**
     * Initialize the WebSocket service with the WebSocket server instance
     */
    initialize(wsServer) {
        this.wsServer = wsServer;
        this.setupDocumentProcessingEvents();
        this.initialized = true;
        this.logger.info('WebSocket service initialized successfully');
    }

    /**
     * Setup document processing event handlers
     */
    setupDocumentProcessingEvents() {
        if (!this.wsServer) {
            this.logger.error('WebSocket server not available for event setup');
            return;
        }

        // Register handlers for document processing events
        this.wsServer.registerMessageHandler('document-subscribe', this.handleDocumentSubscribe.bind(this));
        this.wsServer.registerMessageHandler('document-unsubscribe', this.handleDocumentUnsubscribe.bind(this));
        this.wsServer.registerMessageHandler('get-processing-status', this.handleGetProcessingStatus.bind(this));
        this.wsServer.registerMessageHandler('cancel-processing', this.handleCancelProcessing.bind(this));

        this.logger.info('Document processing WebSocket event handlers registered');
    }

    /**
     * Send a message to a specific user
     * @param {string} userId - The user ID to send the message to
     * @param {string} eventType - The type of event/message
     * @param {Object} data - The data to send
     */
    emitToUser(userId, eventType, data) {
        if (!this.initialized || !this.wsServer) {
            this.logger.warn('WebSocket service not initialized, cannot emit to user');
            return false;
        }

        try {
            const message = {
                type: eventType,
                data: data,
                timestamp: new Date().toISOString()
            };

            const success = this.wsServer.broadcastToUser(userId, message);
            
            if (success) {
                this.logger.info(`Message sent to user ${userId}: ${eventType}`);
            } else {
                this.logger.warn(`Failed to send message to user ${userId}: ${eventType} - user may not be connected`);
            }

            return success;

        } catch (error) {
            this.logger.error(`Error emitting to user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Broadcast a message to all connected users
     * @param {string} eventType - The type of event/message
     * @param {Object} data - The data to send
     */
    broadcast(eventType, data) {
        if (!this.initialized || !this.wsServer) {
            this.logger.warn('WebSocket service not initialized, cannot broadcast');
            return false;
        }

        try {
            const message = {
                type: eventType,
                data: data,
                timestamp: new Date().toISOString()
            };

            this.wsServer.broadcast(message);
            this.logger.info(`Broadcast message sent: ${eventType}`);
            return true;

        } catch (error) {
            this.logger.error('Error broadcasting message:', error);
            return false;
        }
    }

    /**
     * Send document processing progress update to user
     * @param {string} userId - User ID
     * @param {Object} progressData - Progress information
     */
    sendDocumentProgress(userId, progressData) {
        return this.emitToUser(userId, 'document-progress', {
            documentId: progressData.documentId,
            progress: progressData.progress,
            message: progressData.message,
            status: progressData.status,
            jobId: progressData.jobId,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send document processing completion notification
     * @param {string} userId - User ID
     * @param {Object} completionData - Completion information
     */
    sendDocumentCompleted(userId, completionData) {
        return this.emitToUser(userId, 'document-completed', {
            documentId: completionData.documentId,
            result: completionData.result,
            jobId: completionData.jobId,
            processingTime: completionData.processingTime,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send document processing failure notification
     * @param {string} userId - User ID
     * @param {Object} failureData - Failure information
     */
    sendDocumentFailed(userId, failureData) {
        return this.emitToUser(userId, 'document-failed', {
            documentId: failureData.documentId,
            error: failureData.error,
            jobId: failureData.jobId,
            retryAvailable: failureData.retryAvailable || false,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send queue status update to user
     * @param {string} userId - User ID
     * @param {Object} queueStatus - Queue status information
     */
    sendQueueStatus(userId, queueStatus) {
        return this.emitToUser(userId, 'queue-status', {
            summary: queueStatus.summary,
            userPosition: queueStatus.userPosition,
            estimatedWaitTime: queueStatus.estimatedWaitTime,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Handle document subscription request from client
     */
    async handleDocumentSubscribe(ws, data, userId) {
        try {
            this.logger.info(`User ${userId} subscribing to document updates for document ${data.documentId}`);
            
            // Store subscription info on the WebSocket connection
            if (!ws.documentSubscriptions) {
                ws.documentSubscriptions = new Set();
            }
            ws.documentSubscriptions.add(data.documentId);

            // Send confirmation
            ws.send(JSON.stringify({
                type: 'document-subscribed',
                data: { documentId: data.documentId },
                timestamp: new Date().toISOString()
            }));

        } catch (error) {
            this.logger.error(`Error handling document subscribe for user ${userId}:`, error);
        }
    }

    /**
     * Handle document unsubscription request from client
     */
    async handleDocumentUnsubscribe(ws, data, userId) {
        try {
            this.logger.info(`User ${userId} unsubscribing from document updates for document ${data.documentId}`);
            
            if (ws.documentSubscriptions) {
                ws.documentSubscriptions.delete(data.documentId);
            }

            // Send confirmation
            ws.send(JSON.stringify({
                type: 'document-unsubscribed',
                data: { documentId: data.documentId },
                timestamp: new Date().toISOString()
            }));

        } catch (error) {
            this.logger.error(`Error handling document unsubscribe for user ${userId}:`, error);
        }
    }

    /**
     * Handle request for current processing status
     */
    async handleGetProcessingStatus(ws, data, userId) {
        try {
            this.logger.info(`User ${userId} requesting processing status`);

            // This will be implemented when we integrate with the document queue service
            // For now, send a placeholder response
            ws.send(JSON.stringify({
                type: 'processing-status',
                data: {
                    waiting: 0,
                    active: 0,
                    completed: 0,
                    failed: 0
                },
                timestamp: new Date().toISOString()
            }));

        } catch (error) {
            this.logger.error(`Error handling processing status request for user ${userId}:`, error);
        }
    }

    /**
     * Handle document processing cancellation request
     */
    async handleCancelProcessing(ws, data, userId) {
        try {
            this.logger.info(`User ${userId} requesting to cancel processing for document ${data.documentId}`);

            // This will be implemented when we integrate with the document queue service
            // For now, send a placeholder response
            ws.send(JSON.stringify({
                type: 'processing-cancelled',
                data: { 
                    documentId: data.documentId,
                    success: false,
                    message: 'Cancellation not yet implemented'
                },
                timestamp: new Date().toISOString()
            }));

        } catch (error) {
            this.logger.error(`Error handling processing cancellation for user ${userId}:`, error);
        }
    }

    /**
     * Get the number of connected users
     */
    getConnectedUsersCount() {
        if (!this.wsServer || !this.wsServer.clients) {
            return 0;
        }

        // Count unique user IDs
        const uniqueUsers = new Set();
        this.wsServer.clients.forEach(client => {
            if (client.userId) {
                uniqueUsers.add(client.userId);
            }
        });

        return uniqueUsers.size;
    }

    /**
     * Check if a user is currently connected
     */
    isUserConnected(userId) {
        if (!this.wsServer || !this.wsServer.clients) {
            return false;
        }

        for (const client of this.wsServer.clients) {
            if (client.userId === userId && client.readyState === 1) { // WebSocket.OPEN = 1
                return true;
            }
        }

        return false;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            connectedUsers: this.getConnectedUsersCount(),
            serverAvailable: !!this.wsServer
        };
    }
}

// Singleton instance
let webSocketService = null;

/**
 * Get the WebSocket service instance
 * @param {Object} wsServer - Optional WebSocket server instance for initialization
 * @returns {WebSocketService} - The WebSocket service instance
 */
const getWebSocketService = (wsServer = null) => {
    if (!webSocketService) {
        webSocketService = new WebSocketService();
        
        if (wsServer) {
            webSocketService.initialize(wsServer);
        }
    } else if (wsServer && !webSocketService.initialized) {
        webSocketService.initialize(wsServer);
    }
    
    return webSocketService;
};

module.exports = {
    WebSocketService,
    getWebSocketService
}; 