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

  // For page requests, render login page
  return res.status(401).render('login');
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

  return res.status(401).render('login-error');
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
