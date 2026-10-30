const { verifyToken } = require('../controllers/auth.controller');

// Require any logged-in session (user or admin)
exports.requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  const session = verifyToken(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
  req.session = session;
  next();
};

// Require admin role
exports.requireAdmin = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  const session = verifyToken(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
  if (session.type !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  req.session = session;
  next();
};
