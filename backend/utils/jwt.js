const jwt = require('jsonwebtoken');

const JWT_SECRET = 'ciputra-university-secret-key-2024-auth-system';
const JWT_EXPIRES_IN = '8h';

function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    department: user.department,
    clearanceLevel: user.clearanceLevel,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { generateToken, verifyToken, JWT_SECRET };
