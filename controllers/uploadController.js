const config = require('../config');
const { formatFileSize } = require('../utils/fileUtils');

/**
 * Render upload page
 */
const getUploadPage = (req, res) => {
  res.render('upload', {
    maxFileSizeDisplay: formatFileSize(config.maxFileSize),
    allowedTypesDisplay: config.allowedFileTypes.join(', ')
  });
};

/**
 * Handle file upload
 */
const handleUpload = (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      savedName: file.filename,
      size: file.size,
      mimetype: file.mimetype
    }));

    res.json({
      success: true,
      message: `${req.files.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed'
    });
  }
};

module.exports = {
  getUploadPage,
  handleUpload
};
