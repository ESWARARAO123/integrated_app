import React, { useState } from 'react';
import { useDocumentProcessing, DocumentJob } from '../../hooks/useDocumentProcessing';
import './DocumentProcessingStatus.css';

interface DocumentProcessingStatusProps {
  className?: string;
  showDetailedStatus?: boolean;
  maxVisibleJobs?: number;
  compactMode?: boolean;
}

const DocumentProcessingStatus: React.FC<DocumentProcessingStatusProps> = ({
  className = '',
  showDetailedStatus = true,
  maxVisibleJobs = 5,
  compactMode = false
}) => {
  const {
    processingStatus,
    activeJobs,
    isLoading,
    error,
    connected,
    hasActiveProcessing,
    totalJobs,
    cancelDocumentProcessing,
    refreshStatus,
    clearError
  } = useDocumentProcessing();

  const [cancellingJobs, setCancellingJobs] = useState<Set<number>>(new Set());

  // Handle job cancellation
  const handleCancelJob = async (documentId: number) => {
    setCancellingJobs(prev => new Set(prev).add(documentId));
    
    try {
      const success = await cancelDocumentProcessing(documentId);
      if (!success) {
        console.error(`Failed to cancel job for document ${documentId}`);
      }
    } catch (err) {
      console.error('Error cancelling job:', err);
    } finally {
      setCancellingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  // Render progress bar for individual job
  const renderJobProgress = (job: DocumentJob) => {
    const progress = job.progress || 0;
    const isCancelling = cancellingJobs.has(job.documentId);
    
    return (
      <div key={job.documentId} className="doc-processing-job">
        <div className="doc-processing-job-header">
          <div className="doc-processing-job-info">
            <span className="doc-processing-filename" title={job.fileName}>
              {job.fileName.length > 30 ? `${job.fileName.substring(0, 30)}...` : job.fileName}
            </span>
            <span className="doc-processing-status">{job.status}</span>
          </div>
          
          {job.status !== 'completed' && job.status !== 'failed' && (
            <button
              onClick={() => handleCancelJob(job.documentId)}
              disabled={isCancelling}
              className="doc-processing-cancel-btn"
              title="Cancel processing"
            >
              {isCancelling ? 'Canceling...' : '×'}
            </button>
          )}
        </div>

        <div className="doc-processing-progress-container">
          <div className="doc-processing-progress-bar">
            <div
              className={`doc-processing-progress-fill doc-processing-progress-${job.status}`}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          <span className="doc-processing-progress-text">
            {progress > 0 ? `${Math.round(progress)}%` : '0%'}
          </span>
        </div>

        {job.message && (
          <div className="doc-processing-message">
            {job.message}
          </div>
        )}

        {job.error && (
          <div className="doc-processing-error">
            Error: {job.error}
          </div>
        )}

        {job.queuePosition !== undefined && job.queuePosition > 0 && (
          <div className="doc-processing-queue-position">
            Queue position: {job.queuePosition}
          </div>
        )}
      </div>
    );
  };

  // Don't render if no active processing and not loading
  if (!hasActiveProcessing && !isLoading && !error) {
    return null;
  }

  // Use compact mode if specified
  if (compactMode) {
    const primaryJob = activeJobs[0];
    const progress = primaryJob?.progress || 0;

    return (
      <div className={`doc-processing-compact ${className}`}>
        <div className="doc-processing-compact-content">
          <span className="doc-processing-compact-status">
            {primaryJob?.status === 'processing' ? 'Processing' :
             primaryJob?.status === 'completed' ? 'Complete' :
             primaryJob?.status === 'failed' ? 'Failed' : 'Document'}
          </span>
          <span className="doc-processing-compact-text">
            {totalJobs === 1
              ? `Processing ${primaryJob?.fileName?.substring(0, 25)}${primaryJob?.fileName?.length > 25 ? '...' : ''}`
              : `Processing ${totalJobs} documents`
            }
          </span>
          <div className="doc-processing-compact-progress">
            <div
              className="doc-processing-compact-fill"
              style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
            />
          </div>
          <span className="doc-processing-compact-percent">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`doc-processing-status ${className}`}>
      {/* Header */}
      <div className="doc-processing-header">
        <div className="doc-processing-title">
          Document Processing
          {totalJobs > 0 && (
            <span className="doc-processing-count">({totalJobs})</span>
          )}
        </div>
        
        <div className="doc-processing-controls">
          {!connected && (
            <span className="doc-processing-offline" title="WebSocket disconnected">
              Offline
            </span>
          )}

          <button
            onClick={refreshStatus}
            disabled={isLoading}
            className="doc-processing-refresh-btn"
            title="Refresh status"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="doc-processing-error-banner">
          <span>⚠️ {error}</span>
          <button onClick={clearError} className="doc-processing-error-close">
            ✕
          </button>
        </div>
      )}

      {/* Overall status summary */}
      {showDetailedStatus && processingStatus && (
        <div className="doc-processing-summary">
          <div className="doc-processing-summary-stats">
            <div className="doc-processing-stat">
              <span className="doc-processing-stat-label">Active:</span>
              <span className="doc-processing-stat-value">{processingStatus.queue.active}</span>
            </div>
            <div className="doc-processing-stat">
              <span className="doc-processing-stat-label">Waiting:</span>
              <span className="doc-processing-stat-value">{processingStatus.queue.waiting}</span>
            </div>
            <div className="doc-processing-stat">
              <span className="doc-processing-stat-label">Completed:</span>
              <span className="doc-processing-stat-value">{processingStatus.queue.completed}</span>
            </div>
            {processingStatus.queue.failed > 0 && (
              <div className="doc-processing-stat">
                <span className="doc-processing-stat-label">Failed:</span>
                <span className="doc-processing-stat-value doc-processing-stat-error">
                  {processingStatus.queue.failed}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active jobs list */}
      {activeJobs.length > 0 && (
        <div className="doc-processing-jobs">
          <div className="doc-processing-jobs-header">
            <span>Active Documents</span>
            {activeJobs.length > maxVisibleJobs && (
              <span className="doc-processing-jobs-count">
                Showing {maxVisibleJobs} of {activeJobs.length}
              </span>
            )}
          </div>
          
          <div className="doc-processing-jobs-list">
            {activeJobs
              .slice(0, maxVisibleJobs)
              .map(job => renderJobProgress(job))}
          </div>

          {activeJobs.length > maxVisibleJobs && (
            <div className="doc-processing-jobs-more">
              + {activeJobs.length - maxVisibleJobs} more documents processing
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && activeJobs.length === 0 && (
        <div className="doc-processing-loading">
          <span className="doc-processing-spinner">Loading</span>
          Loading processing status...
        </div>
      )}

      {/* No active jobs but has processing status */}
      {!isLoading && activeJobs.length === 0 && hasActiveProcessing && (
        <div className="doc-processing-empty">
          <span>Processing documents in the background...</span>
          <button onClick={refreshStatus} className="doc-processing-refresh-link">
            Refresh
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentProcessingStatus; 