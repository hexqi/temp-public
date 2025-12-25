const config = require('../config');
const { formatFileSize } = require('../utils/fileUtils');

/**
 * Render upload page
 */
const getUploadPage = (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>File Upload Service</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }

        .container {
          max-width: 800px;
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

        .upload-card {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }

        .upload-area {
          border: 3px dashed #ddd;
          border-radius: 12px;
          padding: 60px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s;
          margin-bottom: 20px;
        }

        .upload-area:hover, .upload-area.dragover {
          border-color: #667eea;
          background: #f8f9ff;
        }

        .upload-area h2 {
          color: #555;
          margin-bottom: 10px;
          font-size: 20px;
        }

        .upload-area p {
          color: #999;
          font-size: 14px;
        }

        #fileInput {
          display: none;
        }

        .file-list {
          margin-top: 30px;
        }

        .file-item {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 15px;
        }

        .file-info {
          flex: 1;
          min-width: 200px;
        }

        .file-name {
          font-weight: 600;
          color: #333;
          margin-bottom: 5px;
          word-break: break-all;
        }

        .file-size {
          font-size: 12px;
          color: #999;
        }

        .progress-container {
          flex: 1;
          min-width: 200px;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          transition: width 0.3s;
          border-radius: 4px;
        }

        .progress-text {
          font-size: 12px;
          color: #666;
          margin-top: 5px;
          text-align: right;
        }

        .file-status {
          font-size: 12px;
          font-weight: 600;
          min-width: 80px;
          text-align: right;
        }

        .status-uploading { color: #667eea; }
        .status-success { color: #28a745; }
        .status-error { color: #dc3545; }

        .remove-btn {
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 5px 10px;
          font-size: 12px;
          cursor: pointer;
        }

        .remove-btn:hover { background: #c82333; }

        .upload-btn {
          width: 100%;
          padding: 15px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .upload-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .upload-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

        .text-file-creator {
          margin-top: 20px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .text-file-creator h3 {
          color: #333;
          margin-bottom: 15px;
          font-size: 18px;
        }

        .text-file-creator textarea {
          width: 100%;
          min-height: 120px;
          padding: 12px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-family: monospace;
          font-size: 14px;
          resize: vertical;
        }

        .text-file-creator textarea:focus {
          outline: none;
          border-color: #667eea;
        }

        .text-file-creator input[type="text"] {
          width: 100%;
          padding: 10px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          margin-top: 10px;
          margin-bottom: 10px;
        }

        .text-file-creator input[type="text"]:focus {
          outline: none;
          border-color: #667eea;
        }

        .add-text-btn {
          background: #28a745;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .add-text-btn:hover {
          background: #218838;
        }

        @media (max-width: 600px) {
          .header { flex-direction: column; text-align: center; }
          .file-item { flex-direction: column; align-items: stretch; }
          .file-status { text-align: left; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>File Upload Service</h1>
          <div class="nav-buttons">
            <a href="/file/upload" class="nav-btn primary">Upload</a>
            <a href="/file/download" class="nav-btn secondary">Download</a>
            <a href="/file/logout" class="nav-btn secondary">Logout</a>
          </div>
        </div>

        <div class="upload-card">
          <div class="info-box">
            <strong>Maximum file size:</strong> ${formatFileSize(config.maxFileSize)}<br>
            <strong>Allowed file types:</strong> ${config.allowedFileTypes.join(', ')}
          </div>

          <div class="upload-area" id="uploadArea">
            <h2>Drag & Drop Files Here</h2>
            <p>or click to browse</p>
          </div>

          <input type="file" id="fileInput" multiple>

          <div class="text-file-creator">
            <h3>Create Text File</h3>
            <input type="text" id="textFileName" placeholder="Enter filename (e.g., notes.txt)">
            <textarea id="textFileContent" placeholder="Enter file content..."></textarea>
            <button class="add-text-btn" onclick="addTextFile()">Add Text File</button>
          </div>

          <div class="file-list" id="fileList"></div>

          <button class="upload-btn" id="uploadBtn" onclick="uploadFiles()" disabled>
            Upload All Files
          </button>
        </div>
      </div>

      <script>
        let filesToUpload = [];

        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const fileList = document.getElementById('fileList');
        const uploadBtn = document.getElementById('uploadBtn');

        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
          e.preventDefault();
          uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
          uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
          e.preventDefault();
          uploadArea.classList.remove('dragover');
          handleFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => {
          handleFiles(e.target.files);
          fileInput.value = '';
        });

        function handleFiles(files) {
          for (const file of files) {
            filesToUpload.push({
              file: file,
              id: Date.now() + Math.random(),
              progress: 0,
              status: 'pending'
            });
          }
          renderFileList();
        }

        function addTextFile() {
          const fileName = document.getElementById('textFileName').value.trim();
          const content = document.getElementById('textFileContent').value;

          if (!fileName) {
            alert('Please enter a filename');
            return;
          }

          const blob = new Blob([content], { type: 'text/plain' });
          const file = new File([blob], fileName, { type: 'text/plain' });

          filesToUpload.push({
            file: file,
            id: Date.now() + Math.random(),
            progress: 0,
            status: 'pending'
          });

          document.getElementById('textFileName').value = '';
          document.getElementById('textFileContent').value = '';

          renderFileList();
        }

        function removeFile(id) {
          filesToUpload = filesToUpload.filter(f => f.id !== id);
          renderFileList();
        }

        function formatFileSize(bytes) {
          if (bytes === 0) return '0 Bytes';
          const k = 1024;
          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
        }

        function renderFileList() {
          if (filesToUpload.length === 0) {
            fileList.innerHTML = '';
            uploadBtn.disabled = true;
            return;
          }

          uploadBtn.disabled = false;

          fileList.innerHTML = filesToUpload.map(item => \`
            <div class="file-item">
              <div class="file-info">
                <div class="file-name">${item.file.name}</div>
                <div class="file-size">${formatFileSize(item.file.size)}</div>
              </div>
              <div class="progress-container">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${item.progress}%"></div>
                </div>
                <div class="progress-text">${item.progress}%</div>
              </div>
              <div class="file-status status-${item.status}">
                ${item.status === 'pending' ? 'Pending' :
                  item.status === 'uploading' ? 'Uploading...' :
                  item.status === 'success' ? 'Complete' : 'Failed'}
              </div>
              <button class="remove-btn" onclick="removeFile(${item.id})"
                ${item.status === 'uploading' ? 'disabled' : ''}>
                Remove
              </button>
            </div>
          `).join('');
        }

        async function uploadFiles() {
          const pendingFiles = filesToUpload.filter(f => f.status === 'pending');

          if (pendingFiles.length === 0) return;

          uploadBtn.disabled = true;

          for (const item of pendingFiles) {
            await uploadSingleFile(item);
          }

          uploadBtn.disabled = false;
        }

        function uploadSingleFile(item) {
          return new Promise((resolve) => {
            const formData = new FormData();
            formData.append('files', item.file);

            item.status = 'uploading';
            renderFileList();

            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                item.progress = Math.round((e.loaded / e.total) * 100);
                renderFileList();
              }
            });

            xhr.addEventListener('load', () => {
              if (xhr.status === 200) {
                item.status = 'success';
                item.progress = 100;
              } else {
                item.status = 'error';
              }
              renderFileList();
              resolve();
            });

            xhr.addEventListener('error', () => {
              item.status = 'error';
              renderFileList();
              resolve();
            });

            xhr.open('POST', '/api/file/upload');
            xhr.send(formData);
          });
        }

        renderFileList();
      </script>
    </body>
    </html>
  `);
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
