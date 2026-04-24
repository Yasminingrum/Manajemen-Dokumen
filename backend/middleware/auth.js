const { verifyToken } = require('../utils/jwt');
const { users, getEffectiveUser } = require('../data/store');

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided', code: 'NO_TOKEN' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    const user = users.find(u => u.id === decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive', code: 'USER_INACTIVE' });
    }
    // Terapkan delegasi aktif jika ada
    req.user = getEffectiveUser(user);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
}

module.exports = { authenticate };
