import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './components/Login';
import TryOn from './components/TryOn';
import UserPhotos from './components/UserPhotos';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('try-on');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="App min-h-screen bg-gray-900">
      {!user ? (
        <Login />
      ) : (
        <div className="app-content">
          <header className="bg-gray-800 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <h1 className="text-xl font-semibold text-white">Welcome, {user.email}</h1>
                <div className="flex items-center space-x-4">
                  <nav className="flex space-x-4">
                    <button
                      onClick={() => setActivePage('try-on')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        activePage === 'try-on'
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      Try-On
                    </button>
                    <button
                      onClick={() => setActivePage('photos')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        activePage === 'photos'
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      My Photos
                    </button>
                  </nav>
                  <button 
                    onClick={() => auth.signOut()}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {activePage === 'try-on' ? <TryOn /> : <UserPhotos />}
          </main>
        </div>
      )}
    </div>
  );
}

export default App; 