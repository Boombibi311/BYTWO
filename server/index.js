const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const axios = require('axios');
const authMiddleware = require('./middleware/auth');
const { pool, testConnection, initializeDatabase } = require('./config/database');
const admin = require('./config/firebase');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// Test database connection
testConnection();

// Initialize database tables
initializeDatabase();

// Public routes
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the server!' });
});

// Protected routes
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, display_name, photo_url, created_at, last_login, is_email_verified FROM users WHERE id = ?',
      [req.user.uid]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Error fetching user profile' });
  }
});

// Update user profile
app.put('/api/user/profile', authMiddleware, async (req, res) => {
  const { display_name } = req.body;
  
  try {
    await pool.query(
      'UPDATE users SET display_name = ? WHERE id = ?',
      [display_name, req.user.uid]
    );
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Error updating profile' });
  }
});

// Try-on endpoint (protected)
app.post('/api/try-on', authMiddleware, async (req, res) => {
  try {
    const { model_image, cloth_image, garment_description = "", category = "upper_body" } = req.body;
    
    if (!process.env.SEGMIND_API_KEY) {
      throw new Error('SEGMIND_API_KEY is not configured');
    }

    console.log('Sending request to IDM-VTON API...');
    
    try {
      console.log('=== Making API Request ===');
      console.log('API URL:', 'https://api.segmind.com/v1/idm-vton');

      // Prepare the request data according to Segmind's API spec
      const apiRequestData = {
        crop: false,
        seed: Math.floor(Math.random() * 1000),
        steps: 30,
        category: category,
        force_dc: false,
        human_img: model_image,  // This should be a URL or base64 string
        garm_img: cloth_image,   // This should be a URL or base64 string
        mask_only: false,
        garment_des: garment_description
      };

      console.log('Request data:', {
        ...apiRequestData,
        human_img: apiRequestData.human_img.substring(0, 50) + '...',
        garm_img: apiRequestData.garm_img.substring(0, 50) + '...',
        category: apiRequestData.category
      });

      const response = await axios.post(
        'https://api.segmind.com/v1/idm-vton',
        apiRequestData,
        {
          headers: {
            'x-api-key': process.env.SEGMIND_API_KEY,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      // Log remaining credits and rate limit info
      const remainingCredits = response.headers['x-remaining-credits'];
      const rateLimitReset = response.headers['x-rate-limit-reset-at-utc'];
      const rateLimitRemaining = response.headers['x-rate-limit-remaining'];
      console.log('API Usage:', {
        remainingCredits,
        rateLimitReset,
        rateLimitRemaining
      });

      console.log('=== API Response Details ===');
      console.log('Status:', response.status);
      console.log('Content-Type:', response.headers['content-type']);
      console.log('Generation Time:', response.headers['x-generation-time']);
      console.log('Output Metadata:', response.headers['x-output-metadata']);
      
      // Check if we got a successful response with JPEG content
      if (response.status === 200 && response.headers['content-type'] === 'image/jpeg') {
        console.log('Received valid JPEG response');
        // Set the correct content type and send the image
        res.setHeader('Content-Type', 'image/jpeg');
        res.send(response.data);
      } else {
        // If we get here, something unexpected happened
        console.error('Unexpected response:', {
          status: response.status,
          contentType: response.headers['content-type'],
          dataType: typeof response.data
        });
        throw new Error('Invalid response from API');
      }

    } catch (error) {
      console.error('=== API Error Details ===');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
        
        let errorMessage;
        if (error.response.data instanceof ArrayBuffer) {
          errorMessage = Buffer.from(error.response.data).toString('utf8');
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        }

        // Handle specific API error codes
        switch (error.response.status) {
          case 401:
            errorMessage = 'Invalid API key. Please check your API key configuration.';
            break;
          case 404:
            errorMessage = 'API endpoint not found. Please check the API URL.';
            break;
          case 405:
            errorMessage = 'Invalid request method.';
            break;
          case 406:
            errorMessage = 'Not enough credits. Please check your account balance.';
            break;
          case 429:
            const resetTime = error.response.headers['x-rate-limit-reset-at-utc'];
            errorMessage = `Rate limit exceeded. Please try again after ${resetTime}`;
            break;
          case 500:
            errorMessage = 'Server error. Please try again later.';
            break;
          default:
            errorMessage = errorMessage || 'Unknown error occurred';
        }
        
        res.status(error.response.status).json({ 
          message: errorMessage,
          isRateLimit: error.response.status === 429,
          remainingCredits: error.response.headers['x-remaining-credits'],
          rateLimitReset: error.response.headers['x-rate-limit-reset-at-utc']
        });
      } else if (error.request) {
        res.status(500).json({ 
          message: 'No response received from API. Please check your internet connection.'
        });
      } else {
        res.status(500).json({ 
          message: 'Error setting up API request: ' + error.message
        });
      }
    }

  } catch (error) {
    console.error('Try-on error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
      data: error.response?.data
    });

    let errorMessage = 'Error processing try-on request';
    
    if (error.response) {
      if (Buffer.isBuffer(error.response.data)) {
        errorMessage = Buffer.from(error.response.data).toString();
      } 
      else if (error.response.data?.message) {
        errorMessage = error.response.data.message;
      }
      else if (typeof error.response.data === 'string') {
        errorMessage = error.response.data;
      }
      
      errorMessage = `Error ${error.response.status}: ${errorMessage}`;
    }
    
    console.error('Final error message:', errorMessage);
    res.status(error.response?.status || 500).json({ 
      message: errorMessage,
      isRateLimit: error.response?.status === 429
    });
  }
});

// Database status endpoint
app.get('/api/db-status', async (req, res) => {
  try {
    const isConnected = await testConnection();
    if (isConnected) {
      // Get some basic database stats
      const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
      const [dbInfo] = await pool.query('SELECT DATABASE() as db_name, VERSION() as version');
      
      res.json({
        status: 'connected',
        database: dbInfo[0].db_name,
        version: dbInfo[0].version,
        users: userCount[0].count,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        status: 'disconnected',
        error: 'Database connection failed'
      });
    }
  } catch (error) {
    console.error('Database status check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    auth: {
      headers: req.headers.authorization ? 'Authorization header present' : 'No authorization header'
    }
  });
});

// Auth test endpoint
app.get('/api/auth/test', authMiddleware, (req, res) => {
  res.json({ 
    message: 'Auth successful',
    user: req.user
  });
});

// Protected route example
app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({ 
    message: 'Protected route accessed successfully',
    user: req.user
  });
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 