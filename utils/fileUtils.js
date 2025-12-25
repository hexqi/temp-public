const fs = require('fs');
const path = require('path');

/**
 * Get list of files in a directory with metadata
 */
const getFileList = (dirPath) => {
  try {
    const files = fs.readdirSync(dirPath);
    const fileList = files.map(filename => {
      const filePath = path.join(dirPath, filename);
      const stats = fs.statSync(filePath);

      return {
        name: filename,
        size: stats.size,
        modified: stats.mtime,
        isDirectory: stats.isDirectory()
      };
    });

    return fileList
      .filter(file => !file.isDirectory)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
};

/**
 * Format file size for display
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Format date for display
 */
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

module.exports = {
  getFileList,
  formatFileSize,
  formatDate
};
