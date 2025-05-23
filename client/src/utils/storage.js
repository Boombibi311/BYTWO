import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Upload a file to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} path - The storage path (e.g., 'users/{userId}/profile.jpg')
 * @returns {Promise<string>} The download URL of the uploaded file
 */
export const uploadFile = async (file, path) => {
  try {
    // Create a storage reference
    const storageRef = ref(storage, path);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file: ' + error.message);
  }
};

/**
 * Delete a file from Firebase Storage
 * @param {string} path - The storage path of the file to delete
 */
export const deleteFile = async (path) => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file: ' + error.message);
  }
};

/**
 * Generate a unique file path for user uploads
 * @param {string} userId - The user's ID
 * @param {string} fileType - The type of file (e.g., 'profile', 'try-on')
 * @param {string} fileExtension - The file extension (e.g., 'jpg', 'png')
 * @returns {string} A unique path for the file
 */
export const generateFilePath = (userId, fileType, fileExtension) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  return `users/${userId}/${fileType}/${timestamp}-${randomString}.${fileExtension}`;
}; 