const path = require('path');
const sanitize = require('sanitize-filename');

/**
 * Sanitize filename to prevent path traversal attacks
 */
const sanitizeFilename = (filename) => {
  const sanitized = sanitize(filename, {
    replacement: '_',
    maxLength: 255
  });

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return `file_${Date.now()}`;
  }

  return sanitized;
};

/**
 * Validate that a path is within a base directory
 */
const validatePath = (requestedPath, baseDir) => {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(baseDir, requestedPath);

  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new Error('Invalid path: path traversal detected');
  }

  return resolvedPath;
};

/**
 * Generate safe file path
 */
const getSafeFilePath = (filename, baseDir) => {
  const sanitized = sanitizeFilename(filename);
  return validatePath(sanitized, baseDir);
};

module.exports = {
  sanitizeFilename,
  validatePath,
  getSafeFilePath
};
