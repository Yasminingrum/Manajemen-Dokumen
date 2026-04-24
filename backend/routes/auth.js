const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { users, oauthUsers, addLog } = require('../data/store');
const { generateToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');

// ============================================================
// POST /api/auth/login — JWT Login
// ============================================================
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = users.find(u => u.email === email.toLowerCase());
  if (!user) {
    addLog('unknown', email, 'LOGIN', 'AUTH', 'DENIED', 'User not found');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.isActive) {
    addLog(user.id, user.username, 'LOGIN', 'AUTH', 'DENIED', 'Account inactive');
    return res.status(403).json({ error: 'Account is inactive' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    addLog(user.id, user.username, 'LOGIN', 'AUTH', 'DENIED', 'Wrong password');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user);
  addLog(user.id, user.username, 'LOGIN', 'AUTH', 'ALLOWED', 'JWT login successful');

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      department: user.department,
      clearanceLevel: user.clearanceLevel,
    },
  });
});

// ============================================================
// POST /api/auth/oauth/google — Mock Google OAuth 2.0
// Simulates the callback after Google redirects back
// In production: exchange code for token, verify with Google
// ============================================================
router.post('/oauth/google', (req, res) => {
  const { mockEmail, mockName } = req.body;

  if (!mockEmail) {
    return res.status(400).json({ error: 'Google OAuth requires email' });
  }

  // Check if OAuth user already exists in main users
  let user = users.find(u => u.email === mockEmail.toLowerCase());

  if (!user) {
    // Check oauth users pool
    user = oauthUsers.find(u => u.email === mockEmail.toLowerCase());

    if (!user) {
      // Auto-register OAuth user with default VIEWER role
      user = {
        id: `oauth_${uuidv4().slice(0, 8)}`,
        username: mockName || mockEmail.split('@')[0],
        email: mockEmail.toLowerCase(),
        password: null, // OAuth users have no password
        role: 'VIEWER',
        department: 'General',
        clearanceLevel: 'PUBLIC',
        isActive: true,
        authProvider: 'google',
        createdAt: new Date().toISOString().split('T')[0],
      };
      oauthUsers.push(user);
      // Add to main users array so authenticate middleware can find them
      users.push(user);
    }
  }

  const token = generateToken(user);
  addLog(user.id, user.username, 'OAUTH_LOGIN', 'AUTH', 'ALLOWED', 'Google OAuth 2.0 login');

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      department: user.department,
      clearanceLevel: user.clearanceLevel,
      authProvider: user.authProvider || 'local',
    },
    message: user.authProvider === 'google' ? 'OAuth user auto-registered as VIEWER' : 'Existing user authenticated via OAuth',
  });
});

// ============================================================
// GET /api/auth/me — Get current user info
// ============================================================
router.get('/me', authenticate, (req, res) => {
  const user = req.user;
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    department: user.department,
    clearanceLevel: user.clearanceLevel,
    authProvider: user.authProvider || 'local',
  });
});

// ============================================================
// POST /api/auth/logout — Logout (client-side token deletion)
// ============================================================
router.post('/logout', authenticate, (req, res) => {
  addLog(req.user.id, req.user.username, 'LOGOUT', 'AUTH', 'ALLOWED', 'User logged out');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
