const path = require('path');
const fs = require('fs');

const config = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Session
  sessionSecret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours

  // Authentication
  password: process.env.PASSWORD || 'admin123',

  // File directories
  uploadDir: process.env.UPLOAD_DIR || '/var/www/tmp/receive-files',
  downloadDir: process.env.DOWNLOAD_DIR || '/var/www/tmp/download-files',

  // File upload limits
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB
  allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/zip'
  ]
};

// Validate required configuration
const validateConfig = () => {
  if (config.sessionSecret === 'your-random-secret-key-change-this-in-production') {
    console.warn('WARNING: Using default session secret. Change SESSION_SECRET in production!');
  }
};

validateConfig();

module.exports = config;
