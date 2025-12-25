const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

const config = require('../config');
const { getSafeFilePath } = require('../utils/pathUtils');
const { getFileList, formatFileSize, formatDate } = require('../utils/fileUtils');

/**
 * Escape HTML special characters
 */
const escapeHtml = (text) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};

/**
 * Render download page
 */
const getDownloadPage = (req, res) => {
  const files = getFileList(config.downloadDir).map(file => ({
    ...file,
    sizeFormatted: formatFileSize(file.size),
    modifiedFormatted: formatDate(file.modified)
  }));

  res.render('download', {
    downloadDir: config.downloadDir,
    files: files,
    escapeHtml: escapeHtml,
    protocol: req.protocol,
    host: req.get('host')
  });
};

/**
 * Download single file
 */
const downloadFile = (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = getSafeFilePath(filename, config.downloadDir);

    if (!fs.existsSync(filePath)) {
      return res.status(404).render('404');
    }

    const mimeType = mime.lookup(filePath) || 'application/octet-stream';

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', mimeType);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error reading file'
        });
      }
    });

  } catch (error) {
    console.error('Download error:', error);

    if (!res.headersSent) {
      return res.status(400).render('error', {
        statusCode: 400,
        message: 'Invalid filename specified'
      });
    }
  }
};

/**
 * List files via API
 */
const listFiles = (req, res) => {
  try {
    const files = getFileList(config.downloadDir);
    res.json({
      success: true,
      files: files,
      count: files.length
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list files'
    });
  }
};

module.exports = {
  getDownloadPage,
  downloadFile,
  listFiles
};
