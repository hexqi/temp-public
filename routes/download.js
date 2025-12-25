const express = require('express');

const { requireAuth } = require('../middleware/auth');
const downloadController = require('../controllers/downloadController');

const router = express.Router();

// Download page (requires auth)
router.get('/download', requireAuth, downloadController.getDownloadPage);

// Download file endpoint (requires auth)
router.get('/download/:filename', requireAuth, downloadController.downloadFile);

// API endpoint to list files (requires auth)
router.get('/files', requireAuth, downloadController.listFiles);

module.exports = router;
