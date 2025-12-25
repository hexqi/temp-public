const express = require('express');
const multer = require('multer');
const path = require('path');

const config = require('../config');
const { requireAuth, handleLogin, handleLogout } = require('../middleware/auth');
const uploadController = require('../controllers/uploadController');

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);

    const sanitized = basename.replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${sanitized}-${uniqueSuffix}${ext}`);
  }
});

// Configure multer with security settings
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.maxFileSize,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = config.allowedFileTypes;

    if (allowedMimes.length > 0 && !allowedMimes.includes(file.mimetype)) {
      const error = new Error(`File type ${file.mimetype} is not allowed`);
      error.code = 'LIMIT_FILE_TYPE';
      return cb(error, false);
    }

    cb(null, true);
  }
});

// Login route
router.post('/login', handleLogin);

// Logout route
router.get('/logout', handleLogout);

// Upload page (requires auth)
router.get('/upload', requireAuth, uploadController.getUploadPage);

// Upload API endpoint (requires auth)
router.post('/upload', requireAuth, upload.array('files', 10), uploadController.handleUpload);

module.exports = router;
