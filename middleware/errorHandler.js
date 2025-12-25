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

  // For page requests
  res.status(statusCode).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Error ${statusCode}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f5f5;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .error-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          padding: 40px;
          max-width: 500px;
          text-align: center;
        }
        h1 { color: #e74c3c; margin-bottom: 20px; }
        p { color: #666; line-height: 1.6; margin-bottom: 20px; }
        .back-link {
          color: #667eea;
          text-decoration: none;
          font-weight: 500;
        }
        .back-link:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>Error ${statusCode}</h1>
        <p>${message}</p>
        <a href="/file/upload" class="back-link">Back to Upload Page</a>
      </div>
    </body>
    </html>
  `);
};

module.exports = errorHandler;
