const { admin } = require('../index'); // Get admin from main app
const { pool } = require('../config/database');

// Middleware to verify Firebase token and sync user
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

    // Sync user with MySQL
    try {
      const [result] = await pool.query(`
        INSERT INTO users (id, email, display_name, photo_url, is_email_verified)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          email = VALUES(email),
          display_name = VALUES(display_name),
          photo_url = VALUES(photo_url),
          is_email_verified = VALUES(is_email_verified),
          last_login = CURRENT_TIMESTAMP
      `, [uid, email, name, picture, email_verified]);

      // Add user info to request
      req.user = { uid, email, name, picture, email_verified };
      next();
    } catch (error) {
      console.error('Database sync error:', error.message);
      // Don't fail the request if database sync fails
      req.user = { uid, email, name, picture, email_verified };
      next();
    }
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware; 