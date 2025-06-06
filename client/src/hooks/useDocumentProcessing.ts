import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

/**
 * Document queue status information
 */
export interface DocumentQueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

/**
 * Individual job information
 */
export interface DocumentJob {
  jobId: string;
  documentId: number;
  fileName: string;
  progress?: number;
  queuePosition?: number;
  status: string;
  message?: string;
  timestamp?: string;
  error?: string;
}

/**
 * User processing status from queue
 */
export interface UserProcessingStatus {
  queue: DocumentQueueStatus;
  database: Record<string, number>;
  jobs: {
    active: DocumentJob[];
    waiting: DocumentJob[];
  };
}

/**
 * Document processing events
 */
export interface DocumentProcessingEvent {
  type: 'document-queued' | 'document-progress' | 'document-completed' | 'document-failed' | 'document-cancelled' | 'queue-status';
  documentId?: number;
  jobId?: string;
  progress?: number;
  message?: string;
  status?: string;
  result?: any;
  error?: string;
  queuePosition?: number;
  timestamp: string;
}

/**
 * Hook options
 */
interface UseDocumentProcessingOptions {
  autoSubscribe?: boolean;
  pollingInterval?: number;
  enablePolling?: boolean;
}

/**
 * Custom hook for managing document processing with queue system
 * Provides real-time updates via WebSocket and queue status management
 */
export function useDocumentProcessing(options: UseDocumentProcessingOptions = {}) {
  const {
    autoSubscribe = true,
    pollingInterval = 10000, // Poll every 10 seconds
    enablePolling = true
  } = options;

  // WebSocket context for real-time updates
  const { connected, sendMessage, addMessageListener } = useWebSocket();

  // State management
  const [processingStatus, setProcessingStatus] = useState<UserProcessingStatus | null>(null);
  const [activeJobs, setActiveJobs] = useState<Map<number, DocumentJob>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for tracking subscriptions and polling
  const subscribedDocuments = useRef<Set<number>>(new Set());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch processing status from API
  const fetchProcessingStatus = useCallback(async (): Promise<UserProcessingStatus | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/documents/processing-status', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setProcessingStatus(data.status);
        
        // Update active jobs map
        const newActiveJobs = new Map<number, DocumentJob>();
        data.status.jobs.active.forEach((job: DocumentJob) => {
          newActiveJobs.set(job.documentId, job);
        });
        data.status.jobs.waiting.forEach((job: DocumentJob) => {
          newActiveJobs.set(job.documentId, { ...job, status: 'waiting' });
        });
        setActiveJobs(newActiveJobs);

        return data.status;
      } else {
        throw new Error(data.error || 'Failed to fetch processing status');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching processing status:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Subscribe to document updates
  const subscribeToDocument = useCallback((documentId: number) => {
    if (!connected) {
      console.warn('WebSocket not connected, cannot subscribe to document updates');
      return false;
    }

    if (subscribedDocuments.current.has(documentId)) {
      console.log(`Already subscribed to document ${documentId}`);
      return true;
    }

    try {
      sendMessage('document-subscribe', { documentId });
      subscribedDocuments.current.add(documentId);
      console.log(`Subscribed to document ${documentId} updates`);
      return true;
    } catch (err) {
      console.error(`Failed to subscribe to document ${documentId}:`, err);
      return false;
    }
  }, [connected, sendMessage]);

  // Unsubscribe from document updates
  const unsubscribeFromDocument = useCallback((documentId: number) => {
    if (!connected) {
      console.warn('WebSocket not connected');
      return false;
    }

    if (!subscribedDocuments.current.has(documentId)) {
      console.log(`Not subscribed to document ${documentId}`);
      return true;
    }

    try {
      sendMessage('document-unsubscribe', { documentId });
      subscribedDocuments.current.delete(documentId);
      console.log(`Unsubscribed from document ${documentId} updates`);
      return true;
    } catch (err) {
      console.error(`Failed to unsubscribe from document ${documentId}:`, err);
      return false;
    }
  }, [connected, sendMessage]);

  // Cancel document processing
  const cancelDocumentProcessing = useCallback(async (documentId: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/documents/cancel/${documentId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        // Remove from active jobs
        setActiveJobs(prev => {
          const newMap = new Map(prev);
          newMap.delete(documentId);
          return newMap;
        });

        // Refresh status
        await fetchProcessingStatus();
        return true;
      } else {
        throw new Error(data.error || 'Failed to cancel processing');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error cancelling document processing:', errorMessage);
      setError(errorMessage);
      return false;
    }
  }, [fetchProcessingStatus]);

  // Handle WebSocket document processing events
  const handleDocumentEvent = useCallback((event: DocumentProcessingEvent) => {
    console.log('Received document processing event:', event);

    const { type, documentId, jobId, progress, message, status, error: eventError, queuePosition } = event;

    if (!documentId) return;

    // Update active jobs map
    setActiveJobs(prev => {
      const newMap = new Map(prev);
      const existingJob = newMap.get(documentId);

      if (type === 'document-completed' || type === 'document-failed' || type === 'document-cancelled') {
        // Remove completed, failed, or cancelled jobs
        newMap.delete(documentId);
      } else {
        // Update or add job
        newMap.set(documentId, {
          jobId: jobId || existingJob?.jobId || '',
          documentId,
          fileName: existingJob?.fileName || `Document ${documentId}`,
          progress: progress ?? existingJob?.progress ?? 0,
          queuePosition: queuePosition ?? existingJob?.queuePosition,
          status: status || existingJob?.status || 'processing',
          message: message || existingJob?.message,
          timestamp: event.timestamp,
          error: eventError
        });
      }

      return newMap;
    });

    // Refresh overall status for significant events
    if (['document-completed', 'document-failed', 'document-cancelled'].includes(type)) {
      // Delay to allow backend to update
      setTimeout(() => {
        fetchProcessingStatus();
      }, 1000);
    }
  }, [fetchProcessingStatus]);

  // Set up WebSocket listeners
  useEffect(() => {
    if (!connected) return;

    console.log('Setting up document processing WebSocket listeners');

    // Add listeners for various document events
    const listeners = [
      addMessageListener('document-queued', handleDocumentEvent),
      addMessageListener('document-progress', handleDocumentEvent),
      addMessageListener('document-completed', handleDocumentEvent),
      addMessageListener('document-failed', handleDocumentEvent),
      addMessageListener('document-cancelled', handleDocumentEvent),
      addMessageListener('queue-status', handleDocumentEvent)
    ];

    // Auto-subscribe if enabled and we have active jobs
    if (autoSubscribe) {
      activeJobs.forEach((job, documentId) => {
        subscribeToDocument(documentId);
      });
    }

    // Cleanup function
    return () => {
      console.log('Cleaning up document processing WebSocket listeners');
      listeners.forEach(removeListener => removeListener());
    };
  }, [connected, handleDocumentEvent, autoSubscribe, activeJobs, subscribeToDocument, addMessageListener]);

  // Set up polling for processing status
  useEffect(() => {
    if (!enablePolling) return;

    // Initial fetch
    fetchProcessingStatus();

    // Set up polling interval
    pollingIntervalRef.current = setInterval(() => {
      // Only poll if we have active or waiting jobs
      if (processingStatus && (processingStatus.queue.active > 0 || processingStatus.queue.waiting > 0)) {
        fetchProcessingStatus();
      }
    }, pollingInterval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [enablePolling, pollingInterval, fetchProcessingStatus, processingStatus]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      // Unsubscribe from all documents
      subscribedDocuments.current.forEach(documentId => {
        unsubscribeFromDocument(documentId);
      });
      subscribedDocuments.current.clear();
    };
  }, [unsubscribeFromDocument]);

  // Computed values
  const hasActiveProcessing = processingStatus ? 
    (processingStatus.queue.active > 0 || processingStatus.queue.waiting > 0) : false;

  const totalJobs = processingStatus ? 
    (processingStatus.queue.active + processingStatus.queue.waiting) : 0;

  return {
    // State
    processingStatus,
    activeJobs: Array.from(activeJobs.values()),
    isLoading,
    error,
    connected,

    // Computed values
    hasActiveProcessing,
    totalJobs,

    // Actions
    fetchProcessingStatus,
    subscribeToDocument,
    unsubscribeFromDocument,
    cancelDocumentProcessing,

    // Utils
    refreshStatus: fetchProcessingStatus,
    clearError: () => setError(null)
  };
} 