require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const uploadRoutes = require('./routes/upload');
const downloadRoutes = require('./routes/download');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Ensure required directories exist
const ensureDirectories = () => {
  const dirs = [config.uploadDir, config.downloadDir];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      console.log(`Created directory: ${dir}`);
    }
  });
};

// Session configuration
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production',
    httpOnly: true,
    maxAge: config.sessionMaxAge,
    sameSite: 'lax'
  },
  name: 'fileService.sid'
}));

// Template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use('/file/static', express.static(path.join(__dirname, 'public')));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/file', uploadRoutes);
app.use('/file', downloadRoutes);

app.get('/file', (req, res) => {
  res.redirect(301, '/file/upload');
});

// Health check endpoint
app.get('/file/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
ensureDirectories();

app.listen(PORT, () => {
  console.log(`File service running on port ${PORT}`);
  console.log(`Upload directory: ${config.uploadDir}`);
  console.log(`Download directory: ${config.downloadDir}`);
  console.log(`Environment: ${config.nodeEnv}`);
});

module.exports = app;
