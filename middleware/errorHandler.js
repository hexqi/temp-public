/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Handle Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File size exceeds the maximum limit'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected file field'
    });
  }

  // Handle other errors
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // For API requests
  if (req.path.startsWith('/api/')) {
    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }

  // For page requests - use EJS template
  res.status(statusCode).render('error', {
    statusCode: statusCode,
    message: message
  });
};

module.exports = errorHandler;
