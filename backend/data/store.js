const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// ============================================================
// PERSISTENSI — db.json
// Data disimpan ke file sehingga tidak hilang saat server restart
// ============================================================
const DB_PATH = path.join(__dirname, 'db.json');

const DEFAULT_USERS = [
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

const DEFAULT_DOCUMENTS = [
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

// ============================================================
// Load dari db.json, atau buat baru jika belum ada
// ============================================================
function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const db = JSON.parse(raw);
      // Pastikan semua field ada (untuk migrasi dari versi lama)
      return {
        users: db.users || DEFAULT_USERS,
        documents: db.documents || DEFAULT_DOCUMENTS,
        delegations: db.delegations || [],
      };
    }
  } catch (e) {
    console.warn('[store] Gagal load db.json, pakai data default:', e.message);
  }
  return {
    users: DEFAULT_USERS,
    documents: DEFAULT_DOCUMENTS,
    delegations: [],
  };
}

// ============================================================
// Simpan ke db.json — dipanggil setiap ada perubahan data
// Password di-exclude dari log tapi tetap disimpan (bcrypt hash)
// ============================================================
function saveDB() {
  try {
    const data = JSON.stringify({ users, documents, delegations }, null, 2);
    fs.writeFileSync(DB_PATH, data, 'utf8');
  } catch (e) {
    console.error('[store] Gagal menyimpan db.json:', e.message);
  }
}

// Load data saat modul diinisialisasi
const db = loadDB();
const users = db.users;
let documents = db.documents;
const delegations = db.delegations;
const accessLogs = []; // log tidak perlu persisten

console.log(`[store] Data loaded: ${users.length} users, ${documents.length} dokumen, ${delegations.length} delegasi`);

// ============================================================
// addLog — audit log (in-memory saja, tidak perlu disimpan)
// ============================================================
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

  const activeDelegations = delegations.filter(d =>
    d.toUserId === user.id &&
    d.isActive &&
    new Date(d.startDate) <= now &&
    new Date(d.endDate) >= now
  );

  // Gunakan user.departments jika sudah ada (hasil edit ABAC),
  // fallback ke [user.department] untuk backward compatibility
  const baseDepts = (user.departments && user.departments.length > 0)
    ? user.departments
    : [user.department];

  if (activeDelegations.length === 0) {
    return {
      ...user,
      departments: baseDepts,
      isDelegated: false,
      activeDelegations: [],
    };
  }

  const extraDepts = activeDelegations.map(d => d.delegatedDept).filter(Boolean);
  const allDepts = [...new Set([...baseDepts, ...extraDepts])];

  return {
    ...user,
    departments: allDepts,
    clearanceLevel: user.clearanceLevel,
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

module.exports = { users, documents, delegations, accessLogs, addLog, getEffectiveUser, saveDB };
