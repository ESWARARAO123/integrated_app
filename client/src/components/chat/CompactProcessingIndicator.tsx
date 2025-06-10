import React, { useState } from 'react';
import { useDocumentProcessing } from '../../hooks/useDocumentProcessing';
import './CompactProcessingIndicator.css';

interface CompactProcessingIndicatorProps {
  className?: string;
}

const CompactProcessingIndicator: React.FC<CompactProcessingIndicatorProps> = ({
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    activeJobs,
    hasActiveProcessing,
    totalJobs
  } = useDocumentProcessing();

  // Don't render if no active processing
  if (!hasActiveProcessing && totalJobs === 0) {
    return null;
  }

  // Get the most recent/active job for compact display
  const primaryJob = activeJobs[0];
  const progress = primaryJob?.progress || 0;
  
  // Calculate overall progress if multiple jobs
  const overallProgress = activeJobs.length > 0 
    ? activeJobs.reduce((sum, job) => sum + (job.progress || 0), 0) / activeJobs.length
    : 0;

  const displayProgress = activeJobs.length === 1 ? progress : overallProgress;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return '#3b82f6';
      case 'completed': return '#10b981';
      case 'failed': case 'error': return '#ef4444';
      case 'queued': case 'waiting': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processing': return 'Processing';
      case 'completed': return 'Complete';
      case 'failed': case 'error': return 'Failed';
      case 'queued': case 'waiting': return 'Queued';
      default: return 'Document';
    }
  };

  return (
    <div className={`compact-processing ${className}`}>
      {/* Compact Progress Bar */}
      <div className="compact-progress-container">
        <div className="compact-progress-info">
          <span className="compact-progress-status">
            {primaryJob ? getStatusText(primaryJob.status) : 'Document'}
          </span>
          <span className="compact-progress-text">
            {totalJobs === 1 
              ? `Processing ${primaryJob?.fileName?.substring(0, 20)}${primaryJob?.fileName?.length > 20 ? '...' : ''}`
              : `Processing ${totalJobs} documents`
            }
          </span>
          {totalJobs > 1 && (
            <button
              className="compact-expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Collapse details' : 'Show all documents'}
            >
              {isExpanded ? 'Less' : 'More'}
            </button>
          )}
        </div>
        
        <div className="compact-progress-bar">
          <div 
            className="compact-progress-fill"
            style={{ 
              width: `${Math.max(2, Math.min(100, displayProgress))}%`,
              backgroundColor: primaryJob ? getStatusColor(primaryJob.status) : '#3b82f6'
            }}
          />
        </div>
        
        <span className="compact-progress-percent">
          {Math.round(displayProgress)}%
        </span>
      </div>

      {/* Expanded Details (only if multiple jobs) */}
      {isExpanded && totalJobs > 1 && (
        <div className="compact-expanded-details">
          {activeJobs.slice(0, 3).map((job) => (
            <div key={job.documentId} className="compact-job-item">
              <div className="compact-job-info">
                <span className="compact-job-status">
                  {getStatusText(job.status)}
                </span>
                <span className="compact-job-name">
                  {job.fileName.length > 25 ? `${job.fileName.substring(0, 25)}...` : job.fileName}
                </span>
                <span className="compact-job-progress">
                  {Math.round(job.progress || 0)}%
                </span>
              </div>
              <div className="compact-job-bar">
                <div 
                  className="compact-job-fill"
                  style={{ 
                    width: `${Math.max(2, Math.min(100, job.progress || 0))}%`,
                    backgroundColor: getStatusColor(job.status)
                  }}
                />
              </div>
            </div>
          ))}
          {activeJobs.length > 3 && (
            <div className="compact-more-jobs">
              +{activeJobs.length - 3} more documents
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompactProcessingIndicator;
