const { admin } = require('../index'); // Get admin from main app

// Middleware to verify Firebase token
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Check if Firebase Admin is initialized
  if (!admin) {
    console.error('Firebase Admin not initialized');
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }

  try {
    // Verify Firebase token
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email, name, picture, email_verified } = decodedToken;

    // Add user info to request
    req.user = { uid, email, name, picture, email_verified };
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware; 