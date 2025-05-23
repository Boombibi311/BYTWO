import { auth } from '../firebase';

const API_URL = 'http://localhost:3001/api';

// Get the current Firebase token
const getAuthToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    console.error('No user logged in when trying to get token');
    throw new Error('No user logged in');
  }
  try {
    const token = await user.getIdToken();
    console.log('Successfully got Firebase token');
    return token;
  } catch (error) {
    console.error('Error getting Firebase token:', error);
    throw error;
  }
};

// Make an authenticated API request
const authenticatedFetch = async (endpoint, options = {}) => {
  try {
    console.log('Making authenticated request to:', endpoint);
    const token = await getAuthToken();
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('API Response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      console.error('API request failed:', error);
      throw new Error(error.message || 'API request failed');
    }

    // Handle binary responses (like images)
    if (response.headers.get('content-type')?.includes('image/')) {
      return await response.arrayBuffer();
    }

    // Handle JSON responses
    const data = await response.json();
    console.log('API request successful:', endpoint);
    return data;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};

// API methods
export const api = {
  // User profile
  getProfile: () => authenticatedFetch('/user/profile'),
  updateProfile: (data) => authenticatedFetch('/user/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Try-on
  tryOn: (data) => authenticatedFetch('/try-on', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export default api; 