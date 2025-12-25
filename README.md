# File Upload/Download Service

A secure file upload and download service built with Node.js and Express, featuring session-based authentication.

## Features

- **File Upload**
  - Drag & drop multiple files
  - Create and upload text files directly
  - Real-time upload progress tracking
  - Configurable file size limits and allowed types

- **File Download**
  - Browse and download files from a directory
  - Web UI and command-line download support
  - File metadata display (size, modified date)

- **Security**
  - Session-based authentication with password
  - Path traversal protection
  - File type validation
  - Sanitized filenames

## Requirements

- Node.js >= 18.0.0

## Installation

1. Clone or navigate to the project directory:
```bash
cd /Users/wu/Documents/Code/test/2025/251224_file_service
```

2. Install dependencies:
```bash
npm install
```

3. Create environment configuration:
```bash
cp .env.example .env
```

4. Edit `.env` and configure your settings:
```env
PORT=3000
PASSWORD=your-secure-password-here
SESSION_SECRET=your-random-secret-key
UPLOAD_DIR=/var/www/tmp/receive-files
DOWNLOAD_DIR=/var/www/tmp/download-files
MAX_FILE_SIZE=104857600
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf,text/plain
```

5. Create upload directories (if using default paths):
```bash
sudo mkdir -p /var/www/tmp/receive-files
sudo mkdir -p /var/www/tmp/download-files
sudo chown -R $USER:$USER /var/www/tmp
```

## Usage

Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Access

- **Upload Page**: http://localhost:3000/file/upload
- **Download Page**: http://localhost:3000/file/download

You will be prompted to enter the password configured in `.env`.

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/file/login` | Login with password |
| GET | `/file/logout` | Logout |
| GET | `/file/health` | Health check |

### Protected (Requires Authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/file/upload` | Upload page UI |
| POST | `/file/upload` | Upload files |
| GET | `/file/download` | Download page UI |
| GET | `/file/download/:filename` | Download specific file |
| GET | `/file/files` | List files (JSON) |

## Command-Line Download

Download files using wget or curl:

```bash
# Using wget
wget "http://localhost:3000/file/download/filename.txt" -O downloaded.txt

# Using curl
curl -o downloaded.txt "http://localhost:3000/file/download/filename.txt"
```

## Project Structure

```
.
├── config/
│   └── index.js           # Configuration management
├── controllers/
│   ├── uploadController.js   # Upload logic
│   └── downloadController.js # Download logic
├── middleware/
│   ├── auth.js            # Authentication middleware
│   └── errorHandler.js    # Error handling
├── public/
│   └── css/
│       └── style.css      # Shared styles
├── routes/
│   ├── upload.js          # Upload routes
│   └── download.js        # Download routes
├── utils/
│   ├── fileUtils.js       # File utilities
│   └── pathUtils.js       # Path security utilities
├── views/
│   ├── login.ejs          # Login page
│   ├── login-error.ejs    # Login error page
│   ├── upload.ejs         # Upload page
│   ├── download.ejs       # Download page
│   ├── error.ejs          # Error page
│   └── 404.ejs            # 404 page
├── .env.example           # Environment variables template
├── server.js              # Main entry point
└── package.json
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | development | Environment mode |
| PASSWORD | admin123 | Login password (CHANGE THIS!) |
| SESSION_SECRET | change-this | Session encryption key |
| SESSION_MAX_AGE | 86400000 | Session max age (24 hours) |
| UPLOAD_DIR | /var/www/tmp/receive-files | Upload destination |
| DOWNLOAD_DIR | /var/www/tmp/download-files | Download source |
| MAX_FILE_SIZE | 104857600 | Max file size in bytes (100MB) |
| ALLOWED_FILE_TYPES | * | Comma-separated MIME types |

## Security Notes

1. **Change default password**: Always set a secure `PASSWORD` in `.env`
2. **Use HTTPS in production**: Set up a reverse proxy (nginx/Apache) with SSL
3. **Session secret**: Generate a random `SESSION_SECRET` for production
4. **File permissions**: Ensure upload directories have proper permissions

## License

ISC
