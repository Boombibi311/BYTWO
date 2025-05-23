import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { storage } from '../firebase';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { uploadFile, generateFilePath } from '../utils/storage';
import { api } from '../utils/api';

function TryOn() {
  const [modelImage, setModelImage] = useState(null);
  const [clothImage, setClothImage] = useState(null);
  const [previewModel, setPreviewModel] = useState(null);
  const [previewCloth, setPreviewCloth] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('upper_body');
  const [showPhotoSelector, setShowPhotoSelector] = useState(null); // 'model' or 'cloth'
  const [userPhotos, setUserPhotos] = useState({
    model: [],
    cloth: []
  });
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [savingResult, setSavingResult] = useState(false);

  // Fetch user's photos when component mounts
  useEffect(() => {
    fetchUserPhotos();
  }, []);

  const fetchUserPhotos = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLoadingPhotos(true);
      const categories = ['model', 'cloth'];
      const newPhotos = { model: [], cloth: [] };

      for (const category of categories) {
        const path = `users/${user.uid}/try-on/${category}`;
        const listRef = ref(storage, path);
        const res = await listAll(listRef);

        const photos = await Promise.all(
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
        newPhotos[category] = photos.sort((a, b) => b.timestamp - a.timestamp);
      }

      setUserPhotos(newPhotos);
    } catch (err) {
      console.error('Error fetching user photos:', err);
      setError('Failed to load your photos: ' + err.message);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handleSelectExistingPhoto = async (photo, type) => {
    try {
      // Ensure user is authenticated
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be signed in to select photos');
      }

      if (type === 'model') {
        setPreviewModel(photo.url);
        setModelImage({ 
          path: photo.path, 
          url: photo.url,
          type: 'storage'
        });
      } else {
        setPreviewCloth(photo.url);
        setClothImage({ 
          path: photo.path, 
          url: photo.url,
          type: 'storage'
        });
      }

      setShowPhotoSelector(null);
    } catch (error) {
      console.error('Error selecting existing photo:', error);
      if (error.code === 'storage/unauthorized') {
        setError('You do not have permission to access this photo. Please sign in again.');
      } else {
        setError('Failed to select photo: ' + error.message);
      }
    }
  };

  const convertToBase64 = async (imageData) => {
    try {
      let blob;
      
      if (imageData.type === 'file' && imageData.file instanceof File) {
        // Handle local file
        blob = imageData.file;
      } else if (imageData.type === 'storage' && imageData.url) {
        // Fetch the image from the URL
        const response = await fetch(imageData.url);
        blob = await response.blob();
      } else {
        throw new Error('Invalid image data');
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const base64String = reader.result.split(',')[1];
            if (!base64String) {
              throw new Error('Failed to convert image to base64');
            }
            resolve(base64String);
          } catch (error) {
            reject(new Error('Failed to convert image to base64: ' + error.message));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read image data'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting to base64:', error);
      throw error;
    }
  };

  const handleImageUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // Show preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'model') {
          setPreviewModel(reader.result);
        } else {
          setPreviewCloth(reader.result);
        }
      };
      reader.readAsDataURL(file);

      // Upload to Firebase Storage if user is authenticated
      const user = auth.currentUser;
      if (user) {
        const fileExtension = file.name.split('.').pop();
        const path = generateFilePath(user.uid, `try-on/${type}`, fileExtension);
        const downloadURL = await uploadFile(file, path);
        
        // Store the file reference
        if (type === 'model') {
          setModelImage({ 
            file, 
            path, 
            url: downloadURL,
            type: 'storage'
          });
        } else {
          setClothImage({ 
            file, 
            path, 
            url: downloadURL,
            type: 'storage'
          });
        }

        // Refresh user photos after upload
        fetchUserPhotos();
      } else {
        // If user is not authenticated, just store the file locally
        if (type === 'model') {
          setModelImage({ 
            file, 
            path: null, 
            url: null,
            type: 'file'
          });
        } else {
          setClothImage({ 
            file, 
            path: null, 
            url: null,
            type: 'file'
          });
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Failed to upload image: ' + error.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const user = auth.currentUser;
    if (!user) {
      setError('You must be signed in to use the try-on feature');
      return;
    }

    if (!modelImage || !clothImage) {
      setError('Please upload both model and cloth images');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const [modelBase64, clothBase64] = await Promise.all([
        convertToBase64(modelImage),
        convertToBase64(clothImage)
      ]);

      const response = await axios.post('http://localhost:3001/api/try-on', {
        model_image: modelBase64,
        cloth_image: clothBase64,
        category: category,
        model_path: modelImage.path,
        cloth_path: clothImage.path
      }, {
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });

      // Create a blob URL for the image
      const blob = new Blob([response.data], { type: 'image/jpeg' });
      const imageUrl = URL.createObjectURL(blob);
      setResult(imageUrl);

      // Removed automatic save - now only saving when user clicks the save button

    } catch (err) {
      console.error('Try-on error:', err);
      setError(err.response?.data?.message || err.message || 'An error occurred during try-on');
    } finally {
      setLoading(false);
    }
  };

  const saveResultToPhotos = async () => {
    if (!result || !auth.currentUser) return;

    try {
      setSavingResult(true);
      setError(null);

      // Convert the result blob URL to a blob
      const response = await fetch(result);
      const blob = await response.blob();
      
      // Create a file from the blob
      const file = new File([blob], 'try-on-result.jpg', { type: 'image/jpeg' });
      
      // Generate a path for the result
      const path = generateFilePath(auth.currentUser.uid, 'try-on/results', 'jpg');
      
      // Upload to Firebase Storage
      await uploadFile(file, path);
      
      // Refresh the user's photos
      await fetchUserPhotos();
      
      // Show success message
      setError('Result saved successfully to your photos!');
    } catch (error) {
      console.error('Error saving result:', error);
      setError('Failed to save result: ' + error.message);
    } finally {
      setSavingResult(false);
    }
  };

  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (previewModel && previewModel.startsWith('blob:')) {
        URL.revokeObjectURL(previewModel);
      }
      if (previewCloth && previewCloth.startsWith('blob:')) {
        URL.revokeObjectURL(previewCloth);
      }
      if (result && result.startsWith('blob:')) {
        URL.revokeObjectURL(result);
      }
    };
  }, [previewModel, previewCloth, result]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-blue-400">Virtual Try-On</h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Category Selection */}
          <div className="flex justify-center space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio text-blue-500"
                name="category"
                value="upper_body"
                checked={category === 'upper_body'}
                onChange={(e) => setCategory(e.target.value)}
              />
              <span className="ml-2">Upper Body</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio text-blue-500"
                name="category"
                value="lower_body"
                checked={category === 'lower_body'}
                onChange={(e) => setCategory(e.target.value)}
              />
              <span className="ml-2">Lower Body</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio text-blue-500"
                name="category"
                value="dresses"
                checked={category === 'dresses'}
                onChange={(e) => setCategory(e.target.value)}
              />
              <span className="ml-2">Dresses</span>
            </label>
          </div>

          <div className="space-y-8">
            {/* Model Image Upload */}
            <div className="space-y-4">
              <label className="block text-lg font-medium text-gray-300">
                Upload Model Image
              </label>
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'model')}
                  className="hidden"
                  id="model-upload"
                />
                <div className="flex justify-center space-x-4 mb-4">
                  <label
                    htmlFor="model-upload"
                    className="cursor-pointer px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                  >
                    Upload New
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPhotoSelector('model')}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Choose from My Photos
                  </button>
                </div>
                <label
                  htmlFor="model-upload"
                  className="cursor-pointer block p-4 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  {previewModel ? (
                    <img
                      src={previewModel}
                      alt="Model preview"
                      className="max-h-64 mx-auto rounded-lg"
                    />
                  ) : (
                    <div className="text-gray-400">
                      <p>Click to upload model image</p>
                      <p className="text-sm">(PNG, JPG, JPEG)</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Cloth Image Upload */}
            <div className="space-y-4">
              <label className="block text-lg font-medium text-gray-300">
                Upload Cloth Image
              </label>
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'cloth')}
                  className="hidden"
                  id="cloth-upload"
                />
                <div className="flex justify-center space-x-4 mb-4">
                  <label
                    htmlFor="cloth-upload"
                    className="cursor-pointer px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                  >
                    Upload New
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPhotoSelector('cloth')}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Choose from My Photos
                  </button>
                </div>
                <label
                  htmlFor="cloth-upload"
                  className="cursor-pointer block p-4 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  {previewCloth ? (
                    <img
                      src={previewCloth}
                      alt="Cloth preview"
                      className="max-h-64 mx-auto rounded-lg"
                    />
                  ) : (
                    <div className="text-gray-400">
                      <p>Click to upload cloth image</p>
                      <p className="text-sm">(PNG, JPG, JPEG)</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <button
              type="submit"
              disabled={loading || !modelImage || !clothImage}
              className={`px-8 py-3 rounded-lg font-medium text-lg transition-colors
                ${loading || !modelImage || !clothImage
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
                }`}
              onClick={handleSubmit}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Try On'
              )}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-400 text-center p-4 bg-red-900/20 rounded-lg">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mt-8">
              <h2 className="text-2xl font-semibold text-center mb-4">Result</h2>
              <div className="border-2 border-gray-600 rounded-lg p-4">
                <img
                  src={result}
                  alt="Try-on result"
                  className="max-h-96 mx-auto rounded-lg"
                  onError={(e) => {
                    console.error('Error loading result image');
                    setError('Error displaying result image. Please try again.');
                    e.target.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('Result image loaded successfully');
                  }}
                />
                
                {/* Save Result Button */}
                {auth.currentUser && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={saveResultToPhotos}
                      disabled={savingResult}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors
                        ${savingResult 
                          ? 'bg-gray-600 cursor-not-allowed' 
                          : 'bg-green-500 hover:bg-green-600'
                        }`}
                    >
                      {savingResult ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          Save to My Photos
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Photo Selector Modal */}
        {showPhotoSelector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">
                  Select {showPhotoSelector === 'model' ? 'Model' : 'Cloth'} Photo
                </h3>
                <button
                  onClick={() => setShowPhotoSelector(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {loadingPhotos ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : userPhotos[showPhotoSelector].length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No {showPhotoSelector} photos found
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {userPhotos[showPhotoSelector].map((photo) => {
                    console.log(`Rendering photo: ${photo.name} with URL: ${photo.url}`); // Debug log
                    return (
                      <button
                        key={photo.path}
                        onClick={() => handleSelectExistingPhoto(photo, showPhotoSelector)}
                        className="relative aspect-square group w-full text-left"
                      >
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="w-full h-full object-cover rounded-lg"
                          onError={(e) => {
                            console.error(`Error loading image ${photo.name}:`, e);
                            e.target.style.display = 'none';
                          }}
                          onLoad={() => {
                            console.log(`Successfully loaded image ${photo.name}`);
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            Select
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TryOn; 