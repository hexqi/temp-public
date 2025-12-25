const config = require('../config');

/**
 * Middleware to check if user is authenticated
 */
const requireAuth = (req, res, next) => {
  if (req.session && req.session.isAuthenticated) {
    return next();
  }

  // For API requests, return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  // For page requests, redirect to login or show login page
  return res.status(401).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login Required</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .login-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 40px;
          max-width: 400px;
          width: 100%;
        }
        h1 {
          color: #333;
          margin-bottom: 10px;
          font-size: 24px;
        }
        .subtitle {
          color: #666;
          margin-bottom: 30px;
          font-size: 14px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          color: #555;
          margin-bottom: 8px;
          font-weight: 500;
          font-size: 14px;
        }
        input[type="password"] {
          width: 100%;
          padding: 12px 15px;
          border: 2px solid #e1e5e9;
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.3s;
        }
        input[type="password"]:focus {
          outline: none;
          border-color: #667eea;
        }
        .btn-login {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .btn-login:hover {
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <h1>Authentication Required</h1>
        <p class="subtitle">Please login to access this service</p>

        <form method="POST" action="/file/login">
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required autofocus>
          </div>
          <button type="submit" class="btn-login">Login</button>
        </form>
      </div>
    </body>
    </html>
  `);
};

/**
 * Handle login POST request
 */
const handleLogin = (req, res) => {
  const { password } = req.body;

  if (password === config.password) {
    req.session.isAuthenticated = true;
    req.session.loginTime = new Date().toISOString();

    const redirectTo = req.session.returnTo || '/file/upload';
    delete req.session.returnTo;

    return res.redirect(redirectTo);
  }

  return res.status(401).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login Failed</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .login-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 40px;
          max-width: 400px;
          width: 100%;
        }
        h1 { color: #c33; margin-bottom: 10px; font-size: 24px; }
        .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; color: #555; margin-bottom: 8px; font-weight: 500; font-size: 14px; }
        input[type="password"] {
          width: 100%;
          padding: 12px 15px;
          border: 2px solid #e1e5e9;
          border-radius: 8px;
          font-size: 14px;
        }
        input[type="password"]:focus {
          outline: none;
          border-color: #667eea;
        }
        .btn-login {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <h1>Login Failed</h1>
        <p class="subtitle">Invalid password. Please try again.</p>

        <form method="POST" action="/file/login">
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required autofocus>
          </div>
          <button type="submit" class="btn-login">Login</button>
        </form>
      </div>
    </body>
    </html>
  `);
};

/**
 * Handle logout
 */
const handleLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/file/upload');
  });
};

module.exports = {
  requireAuth,
  handleLogin,
  handleLogout
};
