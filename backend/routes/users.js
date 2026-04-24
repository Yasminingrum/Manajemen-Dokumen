const express = require('express');
const router = express.Router();

const { users, accessLogs, addLog } = require('../data/store');
const { authenticate } = require('../middleware/auth');
const { canManageUsers, canViewAuditLog } = require('../utils/policy');

// ============================================================
// GET /api/users — List all users (ADMIN only)
// ============================================================
router.get('/', authenticate, (req, res) => {
  const { allowed, reason } = canManageUsers(req.user);
  addLog(req.user.id, req.user.username, 'LIST_USERS', 'USERS', allowed ? 'ALLOWED' : 'DENIED', reason);

  if (!allowed) {
    return res.status(403).json({ error: 'Access denied', reason });
  }

  const safeUsers = users.map(({ password, ...rest }) => rest);
  res.json({ users: safeUsers });
});

// ============================================================
// PATCH /api/users/:id/role — Change user role (ADMIN only)
// ============================================================
router.patch('/:id/role', authenticate, (req, res) => {
  const { allowed, reason } = canManageUsers(req.user);
  addLog(req.user.id, req.user.username, 'CHANGE_ROLE', `USER:${req.params.id}`,
    allowed ? 'ALLOWED' : 'DENIED', reason);

  if (!allowed) {
    return res.status(403).json({ error: 'Access denied', reason });
  }

  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { role, clearanceLevel } = req.body;
  const validRoles = ['ADMIN', 'MANAGER', 'STAFF', 'VIEWER'];

  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  if (role) user.role = role;
  if (clearanceLevel) user.clearanceLevel = clearanceLevel;

  const { password, ...safeUser } = user;
  res.json({ user: safeUser, message: 'User updated successfully' });
});

// ============================================================
// GET /api/users/audit-log — Audit log (ADMIN only)
// ============================================================
router.get('/audit-log', authenticate, (req, res) => {
  const { allowed, reason } = canViewAuditLog(req.user);
  addLog(req.user.id, req.user.username, 'VIEW_AUDIT_LOG', 'AUDIT', allowed ? 'ALLOWED' : 'DENIED', reason);

  if (!allowed) {
    return res.status(403).json({ error: 'Access denied', reason });
  }

  res.json({ logs: accessLogs.slice().reverse() });
});

module.exports = router;
