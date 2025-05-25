require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin using environment variables
function initializeFirebase() {
  try {
    const serviceAccount = {
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

    // Validate required fields
    const requiredFields = ['project_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !serviceAccount[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required Firebase credentials: ${missingFields.join(', ')}`);
    }

    // Debug: Log environment variables (remove in production)
    console.log('Firebase configuration:', {
      projectId: serviceAccount.project_id,
      hasPrivateKey: !!serviceAccount.private_key,
      hasClientEmail: !!serviceAccount.client_email,
      hasClientCert: !!serviceAccount.client_x509_cert_url
    });

    // Initialize Firebase Admin
    console.log('Initializing Firebase Admin with project:', serviceAccount.project_id);
    
    // Check if already initialized
    if (admin.apps.length > 0) {
      console.log('Firebase Admin already initialized');
      return admin;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });

    console.log('Firebase Admin initialized successfully');
    return admin;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

// Initialize Firebase and export
let firebaseAdmin;
try {
  firebaseAdmin = initializeFirebase();
} catch (error) {
  console.error('Initial Firebase initialization failed:', error);
  // Don't throw, we'll retry later
}

module.exports = firebaseAdmin; 