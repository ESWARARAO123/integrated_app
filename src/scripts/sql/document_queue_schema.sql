-- Document Queue Schema Updates
-- Add queue-related fields to documents table

-- Check if queue_status column exists, if not add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'queue_status') THEN
        ALTER TABLE documents ADD COLUMN queue_status VARCHAR(20) DEFAULT 'pending';
    END IF;
END $$;

-- Check if job_id column exists, if not add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'job_id') THEN
        ALTER TABLE documents ADD COLUMN job_id VARCHAR(255) NULL;
    END IF;
END $$;

-- Check if queue_priority column exists, if not add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'queue_priority') THEN
        ALTER TABLE documents ADD COLUMN queue_priority INTEGER DEFAULT 0;
    END IF;
END $$;

-- Check if worker_id column exists, if not add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'worker_id') THEN
        ALTER TABLE documents ADD COLUMN worker_id VARCHAR(255) NULL;
    END IF;
END $$;

-- Check if queued_at column exists, if not add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'queued_at') THEN
        ALTER TABLE documents ADD COLUMN queued_at TIMESTAMP NULL;
    END IF;
END $$;

-- Check if processing_started_at column exists, if not add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'processing_started_at') THEN
        ALTER TABLE documents ADD COLUMN processing_started_at TIMESTAMP NULL;
    END IF;
END $$;

-- Check if processing_completed_at column exists, if not add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'processing_completed_at') THEN
        ALTER TABLE documents ADD COLUMN processing_completed_at TIMESTAMP NULL;
    END IF;
END $$;

-- Check if error_message column exists, if not add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'error_message') THEN
        ALTER TABLE documents ADD COLUMN error_message TEXT NULL;
    END IF;
END $$;

-- Check if retry_count column exists, if not add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'retry_count') THEN
        ALTER TABLE documents ADD COLUMN retry_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create index on queue_status for performance
CREATE INDEX IF NOT EXISTS idx_documents_queue_status ON documents(queue_status);

-- Create index on job_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_documents_job_id ON documents(job_id);

-- Create index on user_id and queue_status for user-specific queries
CREATE INDEX IF NOT EXISTS idx_documents_user_queue ON documents(user_id, queue_status);

-- Create index on queued_at for queue ordering
CREATE INDEX IF NOT EXISTS idx_documents_queued_at ON documents(queued_at);

-- Add check constraint for queue_status values
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'chk_documents_queue_status') THEN
        ALTER TABLE documents ADD CONSTRAINT chk_documents_queue_status 
        CHECK (queue_status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'));
    END IF;
END $$;

-- Update existing documents to have 'completed' status if they have been processed
UPDATE documents 
SET queue_status = 'completed', 
    processing_completed_at = updated_at
WHERE status = 'completed' AND queue_status = 'pending';

-- Update existing documents to have 'failed' status if they failed processing
UPDATE documents 
SET queue_status = 'failed',
    error_message = 'Migration: Document failed before queue system'
WHERE status = 'failed' AND queue_status = 'pending';

-- Add comments for documentation
COMMENT ON COLUMN documents.queue_status IS 'Status in the document processing queue: pending, queued, processing, completed, failed, cancelled';
COMMENT ON COLUMN documents.job_id IS 'BullMQ job identifier for tracking queue jobs';
COMMENT ON COLUMN documents.queue_priority IS 'Processing priority in the queue (higher number = higher priority)';
COMMENT ON COLUMN documents.worker_id IS 'Identifier of the worker that processed this document';
COMMENT ON COLUMN documents.queued_at IS 'Timestamp when document was added to the processing queue';
COMMENT ON COLUMN documents.processing_started_at IS 'Timestamp when document processing started';
COMMENT ON COLUMN documents.processing_completed_at IS 'Timestamp when document processing completed';
COMMENT ON COLUMN documents.error_message IS 'Error message if document processing failed';
COMMENT ON COLUMN documents.retry_count IS 'Number of times document processing has been retried';

-- Create a view for queue monitoring
CREATE OR REPLACE VIEW document_queue_status AS
SELECT 
    d.id,
    d.user_id,
    d.filename,
    d.queue_status,
    d.job_id,
    d.queue_priority,
    d.worker_id,
    d.queued_at,
    d.processing_started_at,
    d.processing_completed_at,
    d.error_message,
    d.retry_count,
    d.created_at,
    d.updated_at,
    CASE 
        WHEN d.processing_completed_at IS NOT NULL AND d.processing_started_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (d.processing_completed_at - d.processing_started_at))
        ELSE NULL 
    END as processing_duration_seconds
FROM documents d
ORDER BY 
    CASE d.queue_status 
        WHEN 'processing' THEN 1
        WHEN 'queued' THEN 2
        WHEN 'pending' THEN 3
        WHEN 'failed' THEN 4
        WHEN 'completed' THEN 5
        WHEN 'cancelled' THEN 6
        ELSE 7
    END,
    d.queue_priority DESC,
    d.queued_at ASC;

COMMENT ON VIEW document_queue_status IS 'View for monitoring document processing queue with processing duration calculation';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT ON document_queue_status TO readonly_user;
-- GRANT UPDATE ON documents TO queue_worker; 