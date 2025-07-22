const { pool } = require('../database');

/**
 * Migration to create prediction_db_settings table
 */
async function up() {
  console.log('Creating prediction_db_settings table...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if table already exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'prediction_db_settings'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('✅ prediction_db_settings table already exists, skipping creation');
      await client.query('COMMIT');
      return;
    }
    
    // Create the table
    await client.query(`
      CREATE TABLE prediction_db_settings (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL DEFAULT 'default',
        host TEXT NOT NULL,
        database TEXT NOT NULL,
        "user" TEXT NOT NULL,
        password TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 5432,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create index for faster lookups
    await client.query(`
      CREATE INDEX idx_prediction_db_settings_user_id_username 
      ON prediction_db_settings(user_id, username)
    `);
    
    await client.query('COMMIT');
    console.log('✅ prediction_db_settings table created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 031 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  console.log('Dropping prediction_db_settings table...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop indexes first
    await client.query('DROP INDEX IF EXISTS idx_prediction_db_settings_user_id_username');
    
    // Drop the table
    await client.query('DROP TABLE IF EXISTS prediction_db_settings');

    await client.query('COMMIT');
    console.log('✅ prediction_db_settings table dropped successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 031 down failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down };