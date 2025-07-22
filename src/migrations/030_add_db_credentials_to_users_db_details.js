const { pool } = require('../database');

/**
 * Migration to add db_username and db_password columns to users_db_details table
 */

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Add username column for application username (db_username and db_password already exist)
    await client.query(`
      ALTER TABLE users_db_details 
      ADD COLUMN IF NOT EXISTS username VARCHAR(255);
    `);

    // Get usernames from the main users table and update the username column
    await client.query(`
      UPDATE users_db_details 
      SET username = u.username
      FROM users u 
      WHERE users_db_details.user_id = u.id AND users_db_details.username IS NULL;
    `);

    // Make the username column NOT NULL after populating it
    await client.query(`
      ALTER TABLE users_db_details 
      ALTER COLUMN username SET NOT NULL;
    `);

    await client.query('COMMIT');
    console.log('Migration 030: Added username column to users_db_details table');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 030 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Remove the added username column
    await client.query(`
      ALTER TABLE users_db_details 
      DROP COLUMN IF EXISTS username;
    `);

    await client.query('COMMIT');
    console.log('Migration 030: Removed username column from users_db_details table');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 030 rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down };