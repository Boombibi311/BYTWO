import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase';
import { storage } from '../firebase';
import { ref, listAll, getDownloadURL, deleteObject, uploadBytes } from 'firebase/storage';
import { uploadFile, deleteFile, generateFilePath } from '../utils/storage';

function UserPhotos() {
  const [photos, setPhotos] = useState({
    model: [],
    cloth: [],
    results: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('results');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchUserPhotos();
  }, []);

  const fetchUserPhotos = async () => {
    const user = auth.currentUser;
    if (!user) {
      setError('Please sign in to view your photos');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch photos for each category
      const categories = ['model', 'cloth', 'results'];
      const newPhotos = { model: [], cloth: [], results: [] };

      for (const category of categories) {
        const path = `users/${user.uid}/try-on/${category}`;
        const listRef = ref(storage, path);
        const res = await listAll(listRef);

        const urls = await Promise.all(
          res.items.map(async (itemRef) => {
            const url = await getDownloadURL(itemRef);
            return {
              url,
              path: itemRef.fullPath,
              name: itemRef.name,
              timestamp: parseInt(itemRef.name.split('-')[0])
            };
          })
        );

        // Sort by timestamp (newest first)
        newPhotos[category] = urls.sort((a, b) => b.timestamp - a.timestamp);
      }

      setPhotos(newPhotos);
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError('Failed to load photos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (path) => {
    try {
      await deleteFile(path);
      // Update the photos state by removing the deleted photo
      setPhotos(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].filter(photo => photo.path !== path)
      }));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting photo:', err);
      setError('Failed to delete photo: ' + err.message);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await handleFileUpload(files[0]);
    }
  }, []);

  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (files && files[0]) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    const user = auth.currentUser;
    if (!user) {
      setError('Please sign in to upload photos');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSelectedFile(file);

      const fileExtension = file.name.split('.').pop();
      const path = generateFilePath(user.uid, `try-on/${activeTab}`, fileExtension);
      const downloadURL = await uploadFile(file, path);

      // Add the new photo to the state
      const newPhoto = {
        url: downloadURL,
        path,
        name: file.name,
        timestamp: Date.now()
      };

      setPhotos(prev => ({
        ...prev,
        [activeTab]: [newPhoto, ...prev[activeTab]]
      }));

      setSelectedFile(null);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-blue-400">Your Photos</h1>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex justify-center space-x-4 mb-8">
          {Object.keys(photos).map((category) => (
            <button
              key={category}
              onClick={() => setActiveTab(category)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === category
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>

        {/* Upload Area */}
        <div
          className={`mb-8 p-8 border-2 border-dashed rounded-lg transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-600 hover:border-gray-500'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={uploading}
            />
            <label
              htmlFor="file-upload"
              className={`inline-flex items-center px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                uploading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Upload Photo
                </>
              )}
            </label>
            <p className="mt-2 text-sm text-gray-400">
              Drag and drop an image here, or click to select
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supported formats: JPG, PNG, GIF (max 5MB)
            </p>
          </div>
        </div>

        {/* Photo Grid */}
        {photos[activeTab].length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No {activeTab} photos found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {photos[activeTab].map((photo) => (
              <div
                key={photo.path}
                className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="relative aspect-square group">
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowDeleteConfirm(photo.path)}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-400">
                    {new Date(photo.timestamp).toLocaleString()}
                  </p>
                </div>

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm === photo.path && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-lg max-w-sm mx-4">
                      <h3 className="text-lg font-semibold mb-4">Delete Photo</h3>
                      <p className="text-gray-300 mb-6">
                        Are you sure you want to delete this photo? This action cannot be undone.
                      </p>
                      <div className="flex justify-end space-x-4">
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(photo.path)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default UserPhotos; 