const mysql = require('mysql2/promise');
require('dotenv').config();
const admin = require("firebase-admin");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  socketPath: process.env.DB_SOCKET_PATH,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Option A: Read from a secret (or env var) (recommended)
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT; // (or read from a mounted secret file)
const serviceAccount = JSON.parse(serviceAccountJson);

// Option B: Read from a JSON file (if you copy it in your Dockerfile)
// const serviceAccount = require("/app/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected:', {
      database: process.env.MYSQL_DATABASE,
      host: process.env.MYSQL_HOST
    });
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    return false;
  }
}

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
    console.log('✅ Users table initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    throw error;
  }
}

module.exports = {
  pool,
  testConnection,
  initializeDatabase,
  admin
}; 