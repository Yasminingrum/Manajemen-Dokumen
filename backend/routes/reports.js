const express = require('express');
const router = express.Router();

const { addLog } = require('../data/store');
const { authenticate } = require('../middleware/auth');
const { canAccessSensitiveData } = require('../utils/policy');

// ============================================================
// GET /api/reports/sensitive — Sensitive Financial/HR Data
// RBAC: ADMIN or MANAGER
// ABAC: clearance must be SECRET or above
// Combined: RBAC(role) AND ABAC(clearance >= SECRET)
// ============================================================
router.get('/sensitive', authenticate, (req, res) => {
  const user = req.user;
  const { allowed, reason } = canAccessSensitiveData(user);

  addLog(user.id, user.username, 'ACCESS_SENSITIVE_REPORT', 'REPORTS', allowed ? 'ALLOWED' : 'DENIED', reason);

  if (!allowed) {
    return res.status(403).json({
      error: 'Access denied to sensitive data',
      reason,
      policy: 'RBAC+ABAC: requires (ADMIN or MANAGER role) AND (clearance level SECRET or above)',
    });
  }

  // Mock sensitive data
  const sensitiveData = {
    reportTitle: 'Confidential Executive Summary — Q4 2024',
    generatedFor: user.username,
    accessGrantedBy: reason,
    data: {
      totalPayroll: 'IDR 4,250,000,000',
      executiveSalaries: [
        { position: 'CEO', salary: 'IDR 850,000,000/year' },
        { position: 'CTO', salary: 'IDR 720,000,000/year' },
        { position: 'CFO', salary: 'IDR 710,000,000/year' },
      ],
      financialProjections: {
        Q1_2025: 'IDR 12.5B revenue target',
        Q2_2025: 'IDR 13.2B revenue target',
        growth: '+12.4% YoY',
      },
      securityIncidents: [
        { date: '2024-11-15', type: 'Phishing attempt', status: 'Mitigated' },
        { date: '2024-12-02', type: 'Unauthorized access attempt', status: 'Blocked' },
      ],
    },
    classification: 'TOP_SECRET',
    timestamp: new Date().toISOString(),
  };

  res.json({ report: sensitiveData, accessReason: reason });
});

// ============================================================
// GET /api/reports/department — Department stats (MANAGER+ in own dept)
// ============================================================
router.get('/department', authenticate, (req, res) => {
  const user = req.user;

  if (user.role === 'VIEWER') {
    addLog(user.id, user.username, 'ACCESS_DEPT_REPORT', 'REPORTS', 'DENIED', 'VIEWER cannot view reports');
    return res.status(403).json({ error: 'Access denied', reason: 'VIEWER role cannot access reports' });
  }

  addLog(user.id, user.username, 'ACCESS_DEPT_REPORT', 'REPORTS', 'ALLOWED',
    `${user.role} accessing department report`);

  res.json({
    report: {
      department: user.department,
      stats: {
        employees: Math.floor(Math.random() * 20) + 10,
        activeProjects: Math.floor(Math.random() * 5) + 2,
        budget: `IDR ${Math.floor(Math.random() * 900) + 100}M`,
      },
    },
    accessReason: `RBAC(${user.role}) can view department reports`,
  });
});

module.exports = router;
