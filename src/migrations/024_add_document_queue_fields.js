const fs = require('fs');
const path = require('path');

/**
 * Migration: Add document queue fields
 * Adds queue-related fields to the documents table for BullMQ integration
 */

async function up(pool) {
    console.log('Running migration: Add document queue fields');
    
    try {
        // Read the SQL migration file
        const sqlFilePath = path.join(__dirname, '..', 'scripts', 'sql', 'document_queue_schema.sql');
        const migrationSQL = fs.readFileSync(sqlFilePath, 'utf8');

        console.log('Executing document queue schema updates...');

        // Execute the migration SQL
        await pool.query(migrationSQL);

        console.log('Document queue fields migration completed successfully');

    } catch (error) {
        console.error('Error in document queue migration:', error);
        throw error;
    }
}

async function down(pool) {
    console.log('Running rollback: Remove document queue fields');
    
    try {
        // Drop the view
        await pool.query('DROP VIEW IF EXISTS document_queue_status;');
        console.log('Dropped document_queue_status view');

        // Drop indexes
        const dropIndexes = [
            'DROP INDEX IF EXISTS idx_documents_queue_status;',
            'DROP INDEX IF EXISTS idx_documents_job_id;',
            'DROP INDEX IF EXISTS idx_documents_user_queue;',
            'DROP INDEX IF EXISTS idx_documents_queued_at;'
        ];

        for (const dropIndex of dropIndexes) {
            await pool.query(dropIndex);
        }
        console.log('Dropped document queue indexes');

        // Remove check constraint
        await pool.query('ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_documents_queue_status;');

        // Drop columns
        const dropColumns = [
            'ALTER TABLE documents DROP COLUMN IF EXISTS queue_status;',
            'ALTER TABLE documents DROP COLUMN IF EXISTS job_id;',
            'ALTER TABLE documents DROP COLUMN IF EXISTS queue_priority;',
            'ALTER TABLE documents DROP COLUMN IF EXISTS worker_id;',
            'ALTER TABLE documents DROP COLUMN IF EXISTS queued_at;',
            'ALTER TABLE documents DROP COLUMN IF EXISTS processing_started_at;',
            'ALTER TABLE documents DROP COLUMN IF EXISTS processing_completed_at;',
            'ALTER TABLE documents DROP COLUMN IF EXISTS error_message;',
            'ALTER TABLE documents DROP COLUMN IF EXISTS retry_count;'
        ];

        for (const dropColumn of dropColumns) {
            await pool.query(dropColumn);
        }

        console.log('Document queue fields rollback completed successfully');

    } catch (error) {
        console.error('Error in document queue rollback:', error);
        throw error;
    }
}

module.exports = {
    up,
    down
}; 