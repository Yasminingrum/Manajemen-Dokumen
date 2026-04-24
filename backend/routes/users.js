const express = require('express');
const router = express.Router();

const { users, accessLogs, addLog, saveDB } = require('../data/store');
const { authenticate } = require('../middleware/auth');
const { generateToken } = require('../utils/jwt');
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

  const safeUsers = users.map(({ password, ...rest }) => ({
    ...rest,
    departments: rest.departments || [rest.department],
  }));
  res.json({ users: safeUsers });
});

// ============================================================
// GET /api/users/audit-log — Audit log (ADMIN only)
// PENTING: harus di atas route /:id
// ============================================================
router.get('/audit-log', authenticate, (req, res) => {
  const { allowed, reason } = canViewAuditLog(req.user);
  addLog(req.user.id, req.user.username, 'VIEW_AUDIT_LOG', 'AUDIT', allowed ? 'ALLOWED' : 'DENIED', reason);

  if (!allowed) {
    return res.status(403).json({ error: 'Access denied', reason });
  }

  res.json({ logs: accessLogs.slice().reverse() });
});

// ============================================================
// PATCH /api/users/:id/role — Ubah Role (RBAC) — ADMIN only
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

  // Simpan ke file — data tidak hilang saat restart
  saveDB();

  const { password, ...safeUser } = user;
  const updatedUser = { ...safeUser, departments: safeUser.departments || [safeUser.department] };

  // Jika admin mengubah dirinya sendiri, kirim token baru
  const isSelf = req.user.id === user.id;
  const newToken = isSelf ? generateToken(user) : null;

  res.json({
    user: updatedUser,
    message: 'Role berhasil diubah',
    ...(newToken && { newToken, refreshRequired: true }),
  });
});

// ============================================================
// PATCH /api/users/:id/abac — Ubah Atribut ABAC — ADMIN only
// ============================================================
router.patch('/:id/abac', authenticate, (req, res) => {
  const { allowed, reason } = canManageUsers(req.user);
  addLog(req.user.id, req.user.username, 'CHANGE_ABAC', `USER:${req.params.id}`,
    allowed ? 'ALLOWED' : 'DENIED', reason);

  if (!allowed) {
    return res.status(403).json({ error: 'Access denied', reason });
  }

  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { departments, clearanceLevel } = req.body;
  const validClearance = ['PUBLIC', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET'];
  const validDepts = ['IT', 'Finance', 'HR', 'General', 'Marketing'];

  if (departments !== undefined) {
    if (!Array.isArray(departments) || departments.length === 0) {
      return res.status(400).json({ error: 'departments harus berupa array dengan minimal 1 item' });
    }
    const invalid = departments.filter(d => !validDepts.includes(d));
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Department tidak valid: ${invalid.join(', ')}` });
    }
    user.department = departments[0];
    user.departments = departments;
  }

  if (clearanceLevel !== undefined) {
    if (!validClearance.includes(clearanceLevel)) {
      return res.status(400).json({ error: `Clearance tidak valid. Harus: ${validClearance.join(', ')}` });
    }
    user.clearanceLevel = clearanceLevel;
  }

  // Simpan ke file — data tidak hilang saat restart
  saveDB();

  const { password, ...safeUser } = user;
  const updatedUser = { ...safeUser, departments: safeUser.departments || [safeUser.department] };

  // Jika admin mengubah dirinya sendiri, kirim token baru
  const isSelf = req.user.id === user.id;
  const newToken = isSelf ? generateToken(user) : null;

  res.json({
    user: updatedUser,
    message: 'Atribut ABAC berhasil diubah',
    ...(newToken && { newToken, refreshRequired: true }),
  });
});

module.exports = router;
