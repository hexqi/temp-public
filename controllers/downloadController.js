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
  const files = getFileList(config.downloadDir);

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>File Download Service</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }

        .container {
          max-width: 1000px;
          margin: 0 auto;
        }

        .header {
          background: white;
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 20px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
        }

        .header h1 {
          color: #333;
          font-size: 28px;
        }

        .nav-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .nav-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.3s;
        }

        .nav-btn.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .nav-btn.secondary {
          background: #f0f0f0;
          color: #333;
        }

        .nav-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .download-card {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }

        .file-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        .file-table th {
          text-align: left;
          padding: 15px;
          background: #f8f9fa;
          color: #555;
          font-weight: 600;
          border-bottom: 2px solid #e0e0e0;
        }

        .file-table td {
          padding: 15px;
          border-bottom: 1px solid #f0f0f0;
        }

        .file-table tr:hover {
          background: #f8f9ff;
        }

        .file-name {
          color: #333;
          font-weight: 500;
          word-break: break-all;
        }

        .file-size {
          color: #666;
          font-size: 14px;
        }

        .file-date {
          color: #666;
          font-size: 14px;
        }

        .download-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          transition: all 0.3s;
        }

        .download-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .no-files {
          text-align: center;
          padding: 60px 20px;
          color: #999;
        }

        .no-files h3 {
          font-size: 18px;
          margin-bottom: 10px;
        }

        .info-box {
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
          color: #1565c0;
        }

        .cli-info {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin-top: 20px;
          font-family: monospace;
          font-size: 13px;
          color: #333;
          overflow-x: auto;
        }

        @media (max-width: 768px) {
          .file-table {
            font-size: 14px;
          }
          .file-table th, .file-table td {
            padding: 10px;
          }
          .header {
            flex-direction: column;
            text-align: center;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>File Download Service</h1>
          <div class="nav-buttons">
            <a href="/file/upload" class="nav-btn secondary">Upload</a>
            <a href="/file/download" class="nav-btn primary">Download</a>
            <a href="/file/logout" class="nav-btn secondary">Logout</a>
          </div>
        </div>

        <div class="download-card">
          <div class="info-box">
            <strong>Download Directory:</strong> ${config.downloadDir}<br>
            <strong>Total Files:</strong> ${files.length}
          </div>

          ${files.length === 0 ? \`
            <div class="no-files">
              <h3>No files available for download</h3>
              <p>Files will appear here once they are added to the download directory</p>
            </div>
          \` : \`
            <table class="file-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Size</th>
                  <th>Modified</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                \${files.map(file => \`
                  <tr>
                    <td class="file-name">\${escapeHtml(file.name)}</td>
                    <td class="file-size">\${formatFileSize(file.size)}</td>
                    <td class="file-date">\${formatDate(file.modified)}</td>
                    <td>
                      <a href="/file/download/\${encodeURIComponent(file.name)}"
                         class="download-btn"
                         download="\${escapeHtml(file.name)}">
                        Download
                      </a>
                    </td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>

            <div class="cli-info">
              <strong>CLI Download Command:</strong><br>
              wget "\${req.protocol}://\${req.get('host')}/file/download/<filename>" -O <filename><br><br>
              curl -o <filename> "\${req.protocol}://\${req.get('host')}/file/download/<filename>"
            </div>
          \`}
        </div>
      </div>
    </body>
    </html>
  \`);
};

/**
 * Download single file
 */
const downloadFile = (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = getSafeFilePath(filename, config.downloadDir);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send(\`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>File Not Found</title>
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
            p { color: #666; margin-bottom: 20px; }
            a { color: #667eea; text-decoration: none; font-weight: 500; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>404 - File Not Found</h1>
            <p>The requested file does not exist.</p>
            <a href="/file/download">Back to Download Page</a>
          </div>
        </body>
        </html>
      \`);
    }

    const mimeType = mime.lookup(filePath) || 'application/octet-stream';

    res.setHeader('Content-Disposition', \`attachment; filename="\${encodeURIComponent(filename)}"\`);
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
      res.status(400).send(\`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Download Error</title>
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
            p { color: #666; margin-bottom: 20px; }
            a { color: #667eea; text-decoration: none; font-weight: 500; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Download Error</h1>
            <p>Invalid filename specified.</p>
            <a href="/file/download">Back to Download Page</a>
          </div>
        </body>
        </html>
      \`);
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
