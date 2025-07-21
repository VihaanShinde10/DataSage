// File utility functions

import { FILE_TYPES } from '../constants/config';

/**
 * Extract the file extension from a filename
 * @param {string} filename - The name of the file
 * @returns {string} The lowercase extension without the dot
 */
export const extractFileExtension = (filename) => {
  if (!filename || typeof filename !== 'string') {
    console.error('extractFileExtension: Invalid filename', filename);
    return '';
  }
  
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

/**
 * Get the MIME type from a file extension
 * @param {string} extension - The file extension (without the dot)
 * @returns {string|null} The MIME type or null if not recognized
 */
export const getMimeTypeFromExtension = (extension) => {
  if (!extension || typeof extension !== 'string') {
    return null;
  }
  
  const ext = extension.toLowerCase().replace(/^\./, '');
  
  const extensionToMimeType = {
    'csv': 'text/csv',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'json': 'application/json',
    'txt': 'text/plain'
  };
  
  return extensionToMimeType[ext] || null;
};

/**
 * Check if a file is supported by the application
 * @param {File|Object} file - The file object to check
 * @returns {boolean} Whether the file is supported
 */
export const isFileSupported = (file) => {
  if (!file) {
    return false;
  }
  
  // Check by MIME type first
  if (file.type) {
    const allowedTypes = Object.values(FILE_TYPES).map(type => type.mimeType);
    return allowedTypes.includes(file.type);
  }
  
  // If no MIME type, check by extension
  if (file.name) {
    const extension = extractFileExtension(file.name);
    const mimeType = getMimeTypeFromExtension(extension);
    return mimeType !== null && isFileSupported({ type: mimeType });
  }
  
  return false;
};

/**
 * Validate a filename for allowed characters and patterns
 * @param {string} filename - The filename to validate
 * @returns {Object} Result with isValid flag and error message
 */
export const validateFilename = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return {
      isValid: false,
      error: 'Filename is required'
    };
  }
  
  // Check for invalid characters
  const invalidCharsRegex = /[<>:"/\\|?*\x00-\x1F]/;
  if (invalidCharsRegex.test(filename)) {
    return {
      isValid: false,
      error: 'Filename contains invalid characters'
    };
  }
  
  // Check length
  if (filename.length > 255) {
    return {
      isValid: false,
      error: 'Filename is too long (max 255 characters)'
    };
  }
  
  return {
    isValid: true,
    error: null
  };
};

/**
 * Generate a unique file ID
 * @param {File|Object} file - Optional file object to derive ID from
 * @returns {string} A unique file ID
 */
export const generateUniqueFileId = (file = null) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substr(2, 9);
  
  if (file && file.name) {
    // Include part of the sanitized filename for better readability
    const sanitizedName = file.name
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()
      .substring(0, 10);
    
    return `file-${sanitizedName}-${timestamp}-${randomString}`;
  }
  
  return `file-${timestamp}-${randomString}`;
};

/**
 * Ensure a file object has all necessary properties
 * @param {File|Object} file - The file object to enhance
 * @returns {Object} Enhanced file object with ID and type
 */
export const ensureFileProperties = (file) => {
  if (!file) {
    console.error('ensureFileProperties: File is null or undefined');
    return null;
  }

  // Clone the file object to avoid modifying the original
  let enhancedFile = { ...file };
  
  // Add an ID if not present
  if (!enhancedFile.id) {
    enhancedFile.id = generateUniqueFileId(enhancedFile);
  }

  // Ensure file type is set
  if (!enhancedFile.type || enhancedFile.type === '') {
    if (enhancedFile.name) {
      const extension = extractFileExtension(enhancedFile.name);
      const mimeType = getMimeTypeFromExtension(extension);
      
      if (mimeType) {
        enhancedFile.type = mimeType;
      } else {
        enhancedFile.type = 'application/octet-stream'; // Default binary type
      }
    } else {
      enhancedFile.type = 'application/octet-stream';
    }
  }

  // Ensure other important properties
  if (!enhancedFile.lastModified) {
    enhancedFile.lastModified = Date.now();
  }

  return enhancedFile;
};

/**
 * Format file size in human-readable format
 * @param {number} bytes - The size in bytes
 * @returns {string} Formatted size (e.g. "4.2 MB")
 */
export const formatFileSize = (bytes) => {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0 Bytes';
  }
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}; 