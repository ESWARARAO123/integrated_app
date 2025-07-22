const { pool } = require('../database');

/**
 * Migration: Add missing columns to messages table for PostgreSQL compatibility
 * This fixes the issue where the messages table was missing columns expected by the chatbot code
 */

async function up() {
  console.log('Adding missing columns to messages table...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check which columns need to be added
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages'
    `);
    
    const existingColumns = columnCheck.rows.map(row => row.column_name);
    console.log('Existing columns:', existingColumns);
    
    // Add columns if they don't exist
    const columnsToAdd = [
      { name: 'user_id', type: 'TEXT' },
      { name: 'message', type: 'TEXT' },
      { name: 'response', type: 'TEXT' },
      { name: 'timestamp', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
      { name: 'file_path', type: 'TEXT' },
      { name: 'document_id', type: 'TEXT' },
      { name: 'is_context_update', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'predictor_data', type: 'TEXT' }
    ];
    
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        console.log(`Adding column ${column.name} to messages table`);
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`);
      } else {
        console.log(`Column ${column.name} already exists in messages table`);
      }
    }
    
    await client.query('COMMIT');
    console.log('✅ Missing columns added to messages table successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error adding missing columns to messages table:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  console.log('Removing added columns from messages table...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Columns to drop
    const columnsToDrop = [
      'user_id',
      'message',
      'response',
      'timestamp',
      'file_path',
      'document_id',
      'is_context_update',
      'predictor_data'
    ];
    
    for (const column of columnsToDrop) {
      console.log(`Dropping column ${column} from messages table`);
      await client.query(`ALTER TABLE messages DROP COLUMN IF EXISTS ${column}`);
    }
    
    await client.query('COMMIT');
    console.log('✅ Added columns removed from messages table successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error removing columns from messages table:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down };