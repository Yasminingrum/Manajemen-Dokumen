const express = require('express');
const router = express.Router();
const { users, delegations, addLog, saveDB } = require('../data/store');
const { authenticate } = require('../middleware/auth');

// ============================================================
// GET /api/delegation
// ============================================================
router.get('/', authenticate, (req, res) => {
  const user = req.user;
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Hanya ADMIN yang dapat mengelola delegasi', reason: `Role ${user.role} tidak diizinkan` });
  }
  res.json({ delegations: delegations.map(enrichDelegation) });
});

// ============================================================
// POST /api/delegation — Buat delegasi (ADMIN only)
// ============================================================
router.post('/', authenticate, (req, res) => {
  const user = req.user;

  if (user.role !== 'ADMIN') {
    addLog(user.id, user.username, 'CREATE_DELEGATION', 'DELEGATION', 'DENIED',
      `Role ${user.role} tidak dapat membuat delegasi`);
    return res.status(403).json({ error: 'Hanya ADMIN yang dapat membuat delegasi' });
  }

  const { fromUserId, toUserId, delegatedDept, startDate, endDate, reason } = req.body;

  if (!fromUserId || !toUserId || !delegatedDept || !startDate || !endDate || !reason) {
    return res.status(400).json({ error: 'fromUserId, toUserId, delegatedDept, startDate, endDate, reason wajib diisi' });
  }

  const fromUser = users.find(u => u.id === fromUserId);
  const toUser = users.find(u => u.id === toUserId);

  if (!fromUser) return res.status(404).json({ error: 'User asal tidak ditemukan' });
  if (!toUser) return res.status(404).json({ error: 'User tujuan tidak ditemukan' });
  if (fromUserId === toUserId) return res.status(400).json({ error: 'User asal dan tujuan tidak boleh sama' });

  const existing = delegations.find(d =>
    d.fromUserId === fromUserId &&
    d.toUserId === toUserId &&
    d.delegatedDept === delegatedDept &&
    d.isActive &&
    new Date(d.endDate) >= new Date()
  );
  if (existing) {
    return res.status(400).json({ error: `Sudah ada delegasi aktif dari ${fromUser.username} ke ${toUser.username} untuk dept ${delegatedDept}` });
  }

  const delegation = {
    id: `del_${Date.now()}`,
    fromUserId,
    fromUsername: fromUser.username,
    fromDept: fromUser.department,
    toUserId,
    toUsername: toUser.username,
    toDept: toUser.department,
    delegatedDept,
    startDate,
    endDate,
    reason,
    isActive: true,
    createdAt: new Date().toISOString(),
    createdBy: user.username,
  };

  delegations.push(delegation);

  // Simpan ke file agar tidak hilang saat restart
  saveDB();

  addLog(user.id, user.username, 'CREATE_DELEGATION',
    `${fromUser.username} → ${toUser.username} (dept: ${delegatedDept})`,
    'ALLOWED',
    `Delegasi dept ${delegatedDept} dari ${fromUser.username} ke ${toUser.username} s/d ${endDate}: ${reason}`
  );

  res.status(201).json({
    delegation,
    message: `Akses dept ${delegatedDept} berhasil didelegasikan ke ${toUser.username}`,
    note: `Clearance ${toUser.username} (${toUser.clearanceLevel}) tidak berubah — hanya pekerjaan harian dept ${delegatedDept} yang dapat diakses`,
  });
});

// ============================================================
// DELETE /api/delegation/:id — Cabut delegasi (ADMIN only)
// ============================================================
router.delete('/:id', authenticate, (req, res) => {
  const user = req.user;
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Hanya ADMIN yang dapat mencabut delegasi' });
  }

  const idx = delegations.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Delegasi tidak ditemukan' });

  const delegation = delegations[idx];
  delegation.isActive = false;
  delegation.revokedAt = new Date().toISOString();
  delegation.revokedBy = user.username;

  // Simpan ke file agar tidak hilang saat restart
  saveDB();

  addLog(user.id, user.username, 'REVOKE_DELEGATION', `DELEGATION:${delegation.id}`, 'ALLOWED',
    `Delegasi dept ${delegation.delegatedDept} dari ${delegation.fromUsername} ke ${delegation.toUsername} dicabut`);

  res.json({ message: `Delegasi dept ${delegation.delegatedDept} untuk ${delegation.toUsername} berhasil dicabut` });
});

function enrichDelegation(d) {
  const now = new Date();
  let status;
  if (!d.isActive) status = 'dicabut';
  else if (now < new Date(d.startDate)) status = 'belum_mulai';
  else if (now > new Date(d.endDate)) status = 'kadaluarsa';
  else status = 'aktif';
  return { ...d, status };
}

module.exports = router;
