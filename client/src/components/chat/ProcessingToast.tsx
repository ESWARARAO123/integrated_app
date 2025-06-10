import React, { useState, useEffect } from 'react';
import { useDocumentProcessing } from '../../hooks/useDocumentProcessing';
import './ProcessingToast.css';

interface ProcessingToastProps {
  className?: string;
}

interface ToastMessage {
  id: string;
  type: 'upload' | 'processing' | 'completed' | 'error';
  title: string;
  message: string;
  duration?: number;
  documentId?: number;
}

const ProcessingToast: React.FC<ProcessingToastProps> = ({
  className = ''
}) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { activeJobs } = useDocumentProcessing();

  // Auto-remove toasts after duration
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    toasts.forEach((toast) => {
      if (toast.duration && toast.duration > 0) {
        const timer = setTimeout(() => {
          removeToast(toast.id);
        }, toast.duration);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [toasts]);

  // Listen for job changes to create toasts
  useEffect(() => {
    activeJobs.forEach((job) => {
      const existingToast = toasts.find(t => t.documentId === job.documentId);
      
      // Create toast for new jobs
      if (!existingToast && job.status === 'processing') {
        addToast({
          id: `processing-${job.documentId}`,
          type: 'processing',
          title: 'Processing Started',
          message: `${job.fileName.substring(0, 30)}${job.fileName.length > 30 ? '...' : ''}`,
          duration: 3000,
          documentId: job.documentId
        });
      }
      
      // Update toast for completed jobs
      if (existingToast && job.status === 'completed') {
        removeToast(existingToast.id);
        addToast({
          id: `completed-${job.documentId}`,
          type: 'completed',
          title: 'Processing Complete',
          message: `${job.fileName.substring(0, 30)}${job.fileName.length > 30 ? '...' : ''} is ready`,
          duration: 4000,
          documentId: job.documentId
        });
      }
      
      // Update toast for failed jobs
      if (existingToast && (job.status === 'failed' || job.status === 'error')) {
        removeToast(existingToast.id);
        addToast({
          id: `error-${job.documentId}`,
          type: 'error',
          title: 'Processing Failed',
          message: job.error || 'An error occurred during processing',
          duration: 6000,
          documentId: job.documentId
        });
      }
    });
  }, [activeJobs]);

  const addToast = (toast: ToastMessage) => {
    setToasts(prev => {
      // Remove any existing toast for the same document
      const filtered = prev.filter(t => t.documentId !== toast.documentId);
      return [...filtered, toast];
    });
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getToastIcon = (type: string) => {
    switch (type) {
      case 'upload': return 'Upload';
      case 'processing': return 'Processing';
      case 'completed': return 'Complete';
      case 'error': return 'Error';
      default: return 'Document';
    }
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className={`processing-toast-container ${className}`}>
      {toasts.map((toast) => (
        <div 
          key={toast.id}
          className={`processing-toast processing-toast-${toast.type}`}
        >
          <div className="processing-toast-content">
            <div className="processing-toast-icon">
              {getToastIcon(toast.type)}
            </div>
            <div className="processing-toast-text">
              <div className="processing-toast-title">
                {toast.title}
              </div>
              <div className="processing-toast-message">
                {toast.message}
              </div>
            </div>
            <button 
              className="processing-toast-close"
              onClick={() => removeToast(toast.id)}
              title="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProcessingToast;
