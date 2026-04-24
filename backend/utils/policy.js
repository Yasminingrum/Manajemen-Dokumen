/**
 * ============================================================
 * POLICY ENGINE — RBAC + ABAC Combined
 * ============================================================
 *
 * RBAC — Role:
 *   ADMIN   = pegawai IT + admin sistem. Untuk dokumen,
 *             diperlakukan sama seperti MANAGER di dept-nya.
 *             Tidak bisa akses/hapus dokumen dept lain.
 *   MANAGER = kelola dokumen departemennya (baca/buat/edit/hapus)
 *   STAFF   = operasional dokumen departemennya (baca/buat/edit)
 *   VIEWER  = baca PUBLIC saja
 *
 * ABAC — User attributes:
 *   departments   : array — bisa > 1 jika ada delegasi aktif
 *   clearanceLevel: tidak berubah saat delegasi
 *
 * ABAC — Document attributes:
 *   department    : string
 *   classification: PUBLIC < CONFIDENTIAL < SECRET < TOP_SECRET
 */

const CLEARANCE_ORDER = ['PUBLIC', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET'];

function clearanceRank(level) {
  return CLEARANCE_ORDER.indexOf(level);
}

function hasDeptAccess(user, dept) {
  if (user.departments) return user.departments.includes(dept);
  return user.department === dept;
}

function deptList(user) {
  return user.departments ? user.departments.join(', ') : user.department;
}

// ============================================================
// READ document
// Semua role kecuali VIEWER: clearance cukup + dept sesuai
// ADMIN: diperlakukan seperti MANAGER (dept aslinya saja)
// VIEWER: hanya PUBLIC
// ============================================================
function canReadDocument(user, document) {
  const role = user.role;

  if (role === 'VIEWER') {
    if (document.classification === 'PUBLIC') {
      return { allowed: true, reason: 'VIEWER dapat membaca dokumen PUBLIC' };
    }
    return { allowed: false, reason: 'VIEWER hanya dapat mengakses dokumen PUBLIC' };
  }

  // PUBLIC bisa dibaca semua role (kecuali VIEWER sudah ditangani di atas)
  if (document.classification === 'PUBLIC') {
    return { allowed: true, reason: 'Dokumen PUBLIC dapat diakses semua pegawai' };
  }

  // Cek clearance
  if (clearanceRank(user.clearanceLevel) < clearanceRank(document.classification)) {
    return {
      allowed: false,
      reason: `Clearance tidak cukup: Anda memiliki ${user.clearanceLevel}, dokumen membutuhkan ${document.classification}`,
    };
  }

  // Cek department — ADMIN diperlakukan sama seperti MANAGER/STAFF
  // hanya bisa akses dept-nya sendiri (atau dept delegasi)
  if (!hasDeptAccess(user, document.department)) {
    return {
      allowed: false,
      reason: `Akses ditolak: departemen Anda [${deptList(user)}], dokumen milik dept ${document.department}`,
    };
  }

  const via = user.departments && user.departments.length > 1
    ? `dept [${user.departments.join(', ')}]`
    : `dept ${document.department}`;

  return {
    allowed: true,
    reason: `RBAC(${role}) + ABAC(clearance OK, ${via})`,
  };
}

// ============================================================
// CREATE document
// ADMIN, MANAGER, STAFF: boleh (dokumen masuk ke dept mereka)
// VIEWER: tidak boleh
// ============================================================
function canCreateDocument(user) {
  if (user.role === 'VIEWER') {
    return { allowed: false, reason: 'VIEWER tidak dapat membuat dokumen' };
  }
  return { allowed: true, reason: `Role ${user.role} dapat membuat dokumen di dept ${user.department}` };
}

// ============================================================
// UPDATE document
// ADMIN, MANAGER, STAFF: clearance cukup + dept sesuai
// VIEWER: tidak boleh
// ============================================================
function canUpdateDocument(user, document) {
  const role = user.role;

  if (role === 'VIEWER') {
    return { allowed: false, reason: 'VIEWER hanya memiliki akses baca' };
  }

  if (clearanceRank(user.clearanceLevel) < clearanceRank(document.classification)) {
    return {
      allowed: false,
      reason: `Clearance tidak cukup: ${user.clearanceLevel} tidak dapat mengakses dokumen ${document.classification}`,
    };
  }

  if (!hasDeptAccess(user, document.department)) {
    return {
      allowed: false,
      reason: `Departemen tidak sesuai: Anda [${deptList(user)}], dokumen milik ${document.department}`,
    };
  }

  return {
    allowed: true,
    reason: `RBAC(${role}) + ABAC(clearance OK, dept OK)`,
  };
}

// ============================================================
// DELETE document
// Hanya MANAGER yang bisa menghapus — keputusan manajerial
// ADMIN tidak bisa hapus dokumen (meski dept sendiri)
// MANAGER: dept sesuai + clearance cukup
// STAFF/VIEWER: tidak boleh
// ============================================================
function canDeleteDocument(user, document) {
  const role = user.role;

  if (role === 'ADMIN') {
    return {
      allowed: false,
      reason: 'ADMIN tidak dapat menghapus dokumen — penghapusan adalah keputusan manajerial',
    };
  }

  if (role === 'STAFF' || role === 'VIEWER') {
    return {
      allowed: false,
      reason: `Role ${role} tidak memiliki izin hapus — hanya MANAGER yang dapat menghapus dokumen`,
    };
  }

  // MANAGER — cek clearance
  if (clearanceRank(user.clearanceLevel) < clearanceRank(document.classification)) {
    return {
      allowed: false,
      reason: `Clearance tidak cukup: ${user.clearanceLevel} tidak dapat mengakses dokumen ${document.classification}`,
    };
  }

  // Cek department (termasuk dept delegasi)
  if (!hasDeptAccess(user, document.department)) {
    return {
      allowed: false,
      reason: `MANAGER hanya dapat menghapus dokumen departemennya. Dept Anda: [${deptList(user)}], dokumen milik: ${document.department}`,
    };
  }

  const isDelegated = user.departments && user.departments.length > 1
    && user.department !== document.department;

  return {
    allowed: true,
    reason: isDelegated
      ? `RBAC(MANAGER) + ABAC(dept ${document.department} via delegasi) — penghapusan diizinkan`
      : `RBAC(MANAGER) + ABAC(dept ${document.department}) — penghapusan diizinkan`,
  };
}

// ============================================================
// MANAGE USERS & AUDIT LOG — ADMIN only
// ============================================================
function canManageUsers(user) {
  if (user.role === 'ADMIN') {
    return { allowed: true, reason: 'ADMIN memiliki hak kelola pengguna' };
  }
  return { allowed: false, reason: `Role ${user.role} tidak dapat mengelola pengguna (hanya ADMIN)` };
}

function canViewAuditLog(user) {
  if (user.role === 'ADMIN') {
    return { allowed: true, reason: 'ADMIN dapat melihat audit log' };
  }
  return { allowed: false, reason: `Role ${user.role} tidak dapat melihat audit log (hanya ADMIN)` };
}

module.exports = {
  canReadDocument,
  canCreateDocument,
  canUpdateDocument,
  canDeleteDocument,
  canManageUsers,
  canViewAuditLog,
  CLEARANCE_ORDER,
  hasDeptAccess,
};
