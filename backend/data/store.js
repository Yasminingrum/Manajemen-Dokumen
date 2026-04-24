const bcrypt = require('bcryptjs');

const users = [
  {
    id: 'u001',
    username: 'admin',
    email: 'admin@company.com',
    password: bcrypt.hashSync('admin123', 10),
    role: 'ADMIN',
    department: 'IT',
    clearanceLevel: 'TOP_SECRET',
    isActive: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'u002',
    username: 'manager_finance',
    email: 'manager@company.com',
    password: bcrypt.hashSync('manager123', 10),
    role: 'MANAGER',
    department: 'Finance',
    clearanceLevel: 'SECRET',
    isActive: true,
    createdAt: '2024-01-15',
  },
  {
    id: 'u003',
    username: 'staff_hr',
    email: 'staff@company.com',
    password: bcrypt.hashSync('staff123', 10),
    role: 'STAFF',
    department: 'HR',
    clearanceLevel: 'CONFIDENTIAL',
    isActive: true,
    createdAt: '2024-02-01',
  },
  {
    id: 'u004',
    username: 'viewer',
    email: 'viewer@company.com',
    password: bcrypt.hashSync('viewer123', 10),
    role: 'VIEWER',
    department: 'General',
    clearanceLevel: 'PUBLIC',
    isActive: true,
    createdAt: '2024-02-10',
  },
  {
    id: 'u005',
    username: 'manager_it',
    email: 'manager.it@company.com',
    password: bcrypt.hashSync('managerit123', 10),
    role: 'MANAGER',
    department: 'IT',
    clearanceLevel: 'SECRET',
    isActive: true,
    createdAt: '2024-03-01',
  },
  {
    id: 'u006',
    username: 'staff_it',
    email: 'staff.it@company.com',
    password: bcrypt.hashSync('staffit123', 10),
    role: 'STAFF',
    department: 'IT',
    clearanceLevel: 'CONFIDENTIAL',
    isActive: true,
    createdAt: '2024-03-10',
  },
];

let documents = [
  {
    id: 'd001',
    title: 'IT Infrastructure Plan 2024',
    content: 'Detailed plan for upgrading company IT infrastructure including servers, network, and security systems.',
    department: 'IT',
    classification: 'TOP_SECRET',
    ownerId: 'u001',
    ownerName: 'admin',
    createdAt: '2024-01-10',
    updatedAt: '2024-01-10',
  },
  {
    id: 'd002',
    title: 'Q4 Financial Report',
    content: 'Quarterly financial performance report including revenue, expenses, profit margins, and forecasts.',
    department: 'Finance',
    classification: 'SECRET',
    ownerId: 'u002',
    ownerName: 'manager_finance',
    createdAt: '2024-02-01',
    updatedAt: '2024-02-01',
  },
  {
    id: 'd003',
    title: 'Employee Onboarding Guide',
    content: 'Standard onboarding process and procedures for new employees joining the company.',
    department: 'HR',
    classification: 'CONFIDENTIAL',
    ownerId: 'u003',
    ownerName: 'staff_hr',
    createdAt: '2024-02-15',
    updatedAt: '2024-02-15',
  },
  {
    id: 'd004',
    title: 'Marketing Campaign Brief',
    content: 'Overview of the upcoming Q1 marketing campaign including target audience, channels, and budget.',
    department: 'General',
    classification: 'PUBLIC',
    ownerId: 'u004',
    ownerName: 'viewer',
    createdAt: '2024-03-01',
    updatedAt: '2024-03-01',
  },
  {
    id: 'd005',
    title: 'Salary Structure & Compensation',
    content: 'Detailed breakdown of salary bands, compensation packages, and bonus structures for all levels.',
    department: 'Finance',
    classification: 'TOP_SECRET',
    ownerId: 'u002',
    ownerName: 'manager_finance',
    createdAt: '2024-03-10',
    updatedAt: '2024-03-10',
  },
  {
    id: 'd006',
    title: 'Security Audit Report',
    content: 'Results of the annual security audit including vulnerabilities found, risk assessment, and remediation plan.',
    department: 'IT',
    classification: 'SECRET',
    ownerId: 'u001',
    ownerName: 'admin',
    createdAt: '2024-03-15',
    updatedAt: '2024-03-15',
  },
];

// delegasi sementara — hanya department yang didelegasikan, bukan clearance
const delegations = [];

const accessLogs = [];

function addLog(userId, username, action, resource, result, reason = '') {
  accessLogs.push({
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    userId,
    username,
    action,
    resource,
    result,
    reason,
  });
}

// ============================================================
// getEffectiveUser — ABAC additive
// department bisa lebih dari satu jika ada delegasi aktif
// clearance TIDAK berubah — tetap milik jabatan asli
// ============================================================
function getEffectiveUser(user) {
  const now = new Date();

  // Kumpulkan semua delegasi aktif yang diterima user ini
  const activeDelegations = delegations.filter(d =>
    d.toUserId === user.id &&
    d.isActive &&
    new Date(d.startDate) <= now &&
    new Date(d.endDate) >= now
  );

  if (activeDelegations.length === 0) {
    return {
      ...user,
      departments: [user.department], // selalu array
      isDelegated: false,
      activeDelegations: [],
    };
  }

  // Kumpulkan semua department tambahan dari delegasi aktif
  const extraDepts = activeDelegations.map(d => d.delegatedDept).filter(Boolean);
  const allDepts = [...new Set([user.department, ...extraDepts])];

  return {
    ...user,
    departments: allDepts,       // ABAC additive — array
    clearanceLevel: user.clearanceLevel, // clearance TIDAK berubah
    isDelegated: true,
    activeDelegations: activeDelegations.map(d => ({
      id: d.id,
      fromUsername: d.fromUsername,
      fromDept: d.fromDept,
      delegatedDept: d.delegatedDept,
      endDate: d.endDate,
      reason: d.reason,
    })),
  };
}

module.exports = { users, documents, delegations, accessLogs, addLog, getEffectiveUser };
