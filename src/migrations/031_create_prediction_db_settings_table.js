const { db, databaseType } = require('../database');

function up() {
  console.log('Creating/updating prediction_db_settings table...');
  
  if (databaseType === 'postgres') {
    // PostgreSQL version
    db.exec(`
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);
  } else {
    // SQLite version - check if table exists and recreate with correct structure
    const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='prediction_db_settings'").get();
    
    if (tableInfo) {
      console.log('Existing prediction_db_settings table found, recreating with correct structure...');
      
      // Drop the existing table
      db.exec('DROP TABLE IF EXISTS prediction_db_settings');
    }
    
    // Create the table with the correct structure
    db.exec(`
      CREATE TABLE prediction_db_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL DEFAULT 'default',
        host TEXT NOT NULL,
        database TEXT NOT NULL,
        "user" TEXT NOT NULL,
        password TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 5432,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  
  // Create index for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prediction_db_settings_user_id_username 
    ON prediction_db_settings(user_id, username)
  `);
  
  console.log('? prediction_db_settings table created successfully');
}

function down() {
  console.log('Dropping prediction_db_settings table...');
  
  // Drop indexes first
  db.exec('DROP INDEX IF EXISTS idx_prediction_db_settings_user_id_username');
  
  // Drop the table
  db.exec('DROP TABLE IF EXISTS prediction_db_settings');
  
  console.log('? prediction_db_settings table dropped successfully');
}

module.exports = { up, down };