const admin = require("firebase-admin");
require('dotenv').config();

// Initialize Firebase Admin
let serviceAccount;
try {
  // Try to parse the service account from environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // Fallback to individual environment variables
    serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
      universe_domain: "googleapis.com"
    };
  }

  // Validate required fields
  const requiredFields = ['project_id', 'private_key', 'client_email'];
  const missingFields = requiredFields.filter(field => !serviceAccount[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required Firebase credentials: ${missingFields.join(', ')}`);
  }

  // Initialize Firebase Admin
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });

  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error.message);
  throw error;
}

// Get Firestore instance
const db = admin.firestore();

async function testConnection() {
  try {
    // Test Firestore connection
    await db.collection('_health').doc('check').set({
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Firebase Database connected');
    return true;
  } catch (error) {
    console.error('❌ Firebase Database connection error:', error.message);
    return false;
  }
}

async function initializeDatabase() {
  try {
    // Create users collection if it doesn't exist
    const usersRef = db.collection('users');
    await usersRef.doc('_init').set({
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Users collection initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    throw error;
  }
}

module.exports = {
  db,
  testConnection,
  initializeDatabase,
  admin
}; 