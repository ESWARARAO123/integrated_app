const { Pool } = require('pg');
const path = require('path');
const ini = require('ini');
const fs = require('fs');

// Load database configuration
const configPath = process.env.CONFIG_PATH || path.resolve('./conf/config.ini');
const config = ini.parse(fs.readFileSync(configPath, 'utf-8'));

const pgConfig = {
  host: config.database['database-host'],
  port: config.database['database-port'],
  user: config.database['database-user'],
  password: config.database['database-password'],
  database: config.database['database-name'],
  max: 10,
  ssl: config.database.ssl === 'true'
};

async function up() {
  console.log('Creating users_db_details table...');
  
  const pool = new Pool(pgConfig);
  const client = await pool.connect();
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users_db_details (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL DEFAULT 5432,
        database_name VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        password TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
    `);

    // Create unique constraint for active configurations per user
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_db_details_unique_active 
      ON users_db_details(user_id) 
      WHERE is_active = TRUE;
    `);

    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_db_details_user_id 
      ON users_db_details(user_id);
    `);

    console.log('users_db_details table created successfully');
  } finally {
    client.release();
    await pool.end();
  }
}

async function down() {
  console.log('Dropping users_db_details table...');
  
  const pool = new Pool(pgConfig);
  const client = await pool.connect();
  
  try {
    await client.query('DROP INDEX IF EXISTS idx_users_db_details_unique_active');
    await client.query('DROP INDEX IF EXISTS idx_users_db_details_user_id');
    await client.query('DROP TABLE IF EXISTS users_db_details');
    
    console.log('users_db_details table dropped successfully');
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports = { up, down };