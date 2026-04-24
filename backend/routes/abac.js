const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  canReadDocument, canDeleteDocument, canUpdateDocument,
  canAccessSensitiveData, canCreateDocument,
} = require('../utils/policy');

// ============================================================
// POST /api/abac/simulate — ABAC Simulator
// Cek keputusan akses berdasarkan atribut yang diinput manual
// ============================================================
router.post('/simulate', authenticate, (req, res) => {
  const { userAttrs, resourceAttrs, action } = req.body;

  // Bangun objek user & dokumen virtual dari atribut yang diinput
  const virtualUser = {
    id: 'sim',
    username: 'simulator',
    role: userAttrs.role,
    department: userAttrs.department,
    clearanceLevel: userAttrs.clearanceLevel,
  };

  const virtualDoc = {
    id: 'sim-doc',
    title: 'Dokumen Simulasi',
    department: resourceAttrs.department,
    classification: resourceAttrs.classification,
    ownerId: resourceAttrs.ownerId || 'sim',
  };

  let result;
  switch (action) {
    case 'READ':   result = canReadDocument(virtualUser, virtualDoc); break;
    case 'UPDATE': result = canUpdateDocument(virtualUser, virtualDoc); break;
    case 'DELETE': result = canDeleteDocument(virtualUser, virtualDoc); break;
    case 'CREATE': result = canCreateDocument(virtualUser); break;
    case 'SENSITIVE': result = canAccessSensitiveData(virtualUser); break;
    default: return res.status(400).json({ error: 'Action tidak valid' });
  }

  // Breakdown langkah evaluasi
  const steps = buildEvaluationSteps(virtualUser, virtualDoc, action, result);

  res.json({
    input: { userAttrs, resourceAttrs, action },
    result,
    steps,
  });
});

function buildEvaluationSteps(user, doc, action, finalResult) {
  const CLEARANCE_ORDER = ['PUBLIC', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET'];
  const steps = [];

  steps.push({
    step: 1,
    label: 'Cek Role (RBAC)',
    detail: `Role user: ${user.role}`,
    passed: user.role !== 'VIEWER' || action === 'READ',
  });

  if (action === 'READ' || action === 'UPDATE' || action === 'DELETE') {
    const userRank = CLEARANCE_ORDER.indexOf(user.clearanceLevel);
    const docRank = CLEARANCE_ORDER.indexOf(doc.classification);
    steps.push({
      step: 2,
      label: 'Cek Clearance Level (ABAC)',
      detail: `User clearance: ${user.clearanceLevel} (rank ${userRank}) vs Dokumen classification: ${doc.classification} (rank ${docRank})`,
      passed: userRank >= docRank,
    });

    if (action !== 'DELETE' || user.role !== 'ADMIN') {
      const sameDept = user.department === doc.department;
      steps.push({
        step: 3,
        label: 'Cek Departemen (ABAC)',
        detail: `User dept: ${user.department} vs Dokumen dept: ${doc.department}`,
        passed: sameDept || user.role === 'ADMIN' || doc.classification === 'PUBLIC',
      });
    }
  }

  if (action === 'SENSITIVE') {
    const CLEARANCE_ORDER2 = ['PUBLIC', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET'];
    steps.push({
      step: 2,
      label: 'Cek Clearance ≥ SECRET (ABAC)',
      detail: `User clearance: ${user.clearanceLevel}`,
      passed: CLEARANCE_ORDER2.indexOf(user.clearanceLevel) >= 2,
    });
  }

  steps.push({
    step: steps.length + 1,
    label: 'Keputusan Akhir',
    detail: finalResult.reason,
    passed: finalResult.allowed,
  });

  return steps;
}

module.exports = router;
