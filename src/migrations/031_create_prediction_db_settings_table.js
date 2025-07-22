const { pool } = require('../database');

async function up() {
  console.log('Creating/updating prediction_db_settings table...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create the prediction_db_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS prediction_db_settings (
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
      CREATE INDEX IF NOT EXISTS idx_prediction_db_settings_user_id_username 
      ON prediction_db_settings(user_id, username)
    `);

    await client.query('COMMIT');
    console.log('✅ prediction_db_settings table created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating prediction_db_settings table:', error);
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
    console.error('❌ Error dropping prediction_db_settings table:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down };