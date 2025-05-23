const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Successfully connected to MySQL database!');
    console.log('Database:', process.env.MYSQL_DATABASE);
    console.log('Host:', process.env.MYSQL_HOST);
    
    // Test query - fixed syntax
    const [rows] = await connection.query('SELECT NOW() as server_time');
    console.log('Current database time:', rows[0].server_time);
    
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection error:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    return false;
  }
}

// Create users table if it doesn't exist
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        photo_url VARCHAR(512),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_email_verified BOOLEAN DEFAULT FALSE
      )
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Initialize database and test connection
async function initialize() {
  const isConnected = await testConnection();
  if (isConnected) {
    await initializeDatabase();
  } else {
    console.error('Failed to connect to database. Please check your credentials and connection settings.');
    process.exit(1); // Exit if we can't connect to the database
  }
}

// Call initialize on startup
initialize();

module.exports = {
  pool,
  testConnection
}; 