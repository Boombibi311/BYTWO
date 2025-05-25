require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const axios = require('axios');
const authMiddleware = require('./middleware/auth');
const { admin, db } = require('./config/firebase');

const app = express();
const PORT = process.env.PORT || 8080;

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://bytwo-*.run.app', 'https://*.bytwo.app']  // Add your Cloud Run domain
    : 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/build')));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check Firebase connection
    await db.collection('_health').doc('check').set({
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        firebase: 'connected'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Protected route example
app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: req.user
  });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('CORS origin:', corsOptions.origin);
  console.log('Firebase project:', process.env.FIREBASE_PROJECT_ID);
});

// Add graceful shutdown with timeout
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  const forceShutdown = setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000); // 10 second timeout

  server.close(() => {
    clearTimeout(forceShutdown);
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Add uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

// Add unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

// Export admin for use in other files
module.exports = { admin }; 