# Manajemen Dokumen
### Sistem Otorisasi & Kontrol Akses — JWT · OAuth 2.0 · RBAC · ABAC

---

## Informasi Aplikasi

Manajemen Dokumen adalah aplikasi REST API berbasis web yang mendemonstrasikan implementasi sistem autentikasi dan otorisasi berlapis

| | |
|---|---|
| Platform | Node.js + Express |
| Autentikasi | JWT (JSON Web Token) + OAuth 2.0 Google |
| Otorisasi | RBAC + ABAC (kombinasi) |
| Frontend | HTML/CSS/JS (single file) |
| Database | In-memory (tidak memerlukan instalasi DB) |

---

## Instalasi & Menjalankan

```bash
# 1. Masuk ke folder backend
cd backend

# 2. Install dependencies
npm install

# 3. Buat file .env (lihat bagian Konfigurasi di bawah)

# 4. Jalankan server
node server.js

# 5. Buka browser
# http://localhost:3000
```

### Konfigurasi `.env`

Buat file `.env` di dalam folder `backend/`:

```env
PORT=3000
JWT_SECRET=isi-string-rahasia-bebas
JWT_EXPIRES_IN=8h
SESSION_SECRET=isi-string-rahasia-bebas
GOOGLE_CLIENT_ID=isi-dari-google-cloud-console
GOOGLE_CLIENT_SECRET=isi-dari-google-cloud-console
```

> `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` didapat dari [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth Client ID.
> Authorized redirect URI: `http://localhost:3000/api/auth/oauth/google/callback`

---

## Akun Demo

| Email | Password | Role | Department | Clearance |
|---|---|---|---|---|
| admin@company.com | admin123 | ADMIN | IT | TOP_SECRET |
| manager@company.com | manager123 | MANAGER | Finance | SECRET |
| manager.it@company.com | managerit123 | MANAGER | IT | SECRET |
| staff@company.com | staff123 | STAFF | HR | CONFIDENTIAL |
| staff.it@company.com | staffit123 | STAFF | IT | CONFIDENTIAL |
| viewer@company.com | viewer123 | VIEWER | General | PUBLIC |

---

## Struktur Proyek

```
manajemen-dokumen/
├── backend/
│   ├── data/
│   │   └── store.js          # Database in-memory (users, dokumen, delegasi, log)
│   ├── middleware/
│   │   └── auth.js           # Verifikasi JWT + terapkan delegasi aktif
│   ├── routes/
│   │   ├── auth.js           # Login JWT + OAuth 2.0 callback
│   │   ├── documents.js      # CRUD dokumen + policy check
│   │   ├── users.js          # Manajemen user + audit log
│   │   ├── reports.js        # Data sensitif
│   │   ├── delegation.js     # Role delegation (ABAC additive)
│   │   └── abac.js           # ABAC simulator
│   ├── utils/
│   │   ├── jwt.js            # Generate & verify token
│   │   └── policy.js         # Engine RBAC + ABAC
│   ├── server.js             # Entry point
│   └── .env                  # Konfigurasi (buat sendiri)
├── frontend/
│   └── index.html            # Antarmuka web (single file)
└── README.md
```

---

## Daftar Access Policy

### Peran Pengguna (RBAC)

| Peran | Deskripsi |
|---|---|
| **ADMIN** | Akses penuh ke seluruh sistem |
| **MANAGER** | Akses manajemen dalam departemennya |
| **STAFF** | Akses operasional terbatas dalam departemen |
| **VIEWER** | Hanya bisa membaca dokumen PUBLIC |

### Atribut Pengguna (ABAC)

| Atribut | Keterangan |
|---|---|
| `department` | Departemen user — bisa bertambah saat menerima delegasi |
| `clearanceLevel` | Tingkat izin: PUBLIC < CONFIDENTIAL < SECRET < TOP_SECRET |

### Atribut Dokumen (ABAC)

| Atribut | Keterangan |
|---|---|
| `department` | Departemen pemilik dokumen |
| `classification` | Tingkat kerahasiaan: PUBLIC < CONFIDENTIAL < SECRET < TOP_SECRET |

### Aturan Akses per Operasi

**Membaca Dokumen**
```
ADMIN    → boleh, asal clearance mencukupi
MANAGER  → boleh, asal clearance mencukupi DAN department sesuai
STAFF    → boleh, asal clearance mencukupi DAN department sesuai
VIEWER   → hanya dokumen PUBLIC
```

**Membuat Dokumen**
```
ADMIN, MANAGER, STAFF → boleh
VIEWER                → tidak boleh
```

**Mengubah Dokumen**
```
ADMIN    → boleh semua dokumen
MANAGER  → boleh, asal clearance mencukupi DAN department sesuai
STAFF    → boleh, asal clearance mencukupi DAN department sesuai
VIEWER   → tidak boleh
```

**Menghapus Dokumen** ← contoh RBAC + ABAC
```
ADMIN    → boleh semua dokumen (lintas department)
MANAGER  → boleh, asal clearance mencukupi DAN department sesuai
           (termasuk department dari delegasi aktif)
STAFF    → tidak boleh
VIEWER   → tidak boleh
```

**Mengakses Data Sensitif** ← contoh RBAC + ABAC
```
Syarat 1 (RBAC) : role harus ADMIN atau MANAGER
Syarat 2 (ABAC) : clearance harus SECRET atau TOP_SECRET
→ kedua syarat harus terpenuhi bersamaan
```

**Mengelola Pengguna & Audit Log**
```
ADMIN  → boleh
Lainnya → tidak boleh
```

**Role Delegation**
```
ADMIN  → boleh membuat dan mencabut delegasi
Lainnya → tidak boleh
```

### Hierarki Clearance

```
TOP_SECRET  → bisa akses: PUBLIC, CONFIDENTIAL, SECRET, TOP_SECRET
SECRET      → bisa akses: PUBLIC, CONFIDENTIAL, SECRET
CONFIDENTIAL→ bisa akses: PUBLIC, CONFIDENTIAL
PUBLIC      → bisa akses: PUBLIC saja
```

### Contoh Keputusan RBAC + ABAC

| Skenario | RBAC | ABAC | Hasil |
|---|---|---|---|
| Manager Finance hapus dok Finance (SECRET) | MANAGER ✓ | dept sama, clearance cukup ✓ | **IZIN** |
| Manager Finance hapus dok IT (SECRET) | MANAGER ✓ | dept beda ✗ | **TOLAK** |
| Staff HR baca dok Finance (SECRET) | STAFF ✓ | dept beda ✗ | **TOLAK** |
| Manager (SECRET) akses data sensitif | MANAGER ✓ | clearance SECRET ✓ | **IZIN** |
| Staff akses data sensitif | STAFF ✗ | — | **TOLAK** |
| Manager IT terima delegasi Finance, hapus dok Finance (SECRET) | MANAGER ✓ | dept Finance via delegasi ✓, clearance SECRET ✓ | **IZIN** |
| Manager IT terima delegasi Finance, hapus dok Finance (TOP_SECRET) | MANAGER ✓ | clearance SECRET < TOP_SECRET ✗ | **TOLAK** |

---

## Alur Autentikasi & Otorisasi

### 1. Login JWT

```
User                    Server
 │                         │
 ├── POST /api/auth/login ─→│
 │   {email, password}      │
 │                          ├─ bcrypt.compare(password, hash)
 │                          ├─ jwt.sign({id, role, dept, clearance}, SECRET)
 │←─ {token, user} ─────────┤
 │                          │
 ├── GET /api/documents ───→│  Authorization: Bearer <token>
 │                          ├─ jwt.verify(token, SECRET)      [middleware]
 │                          ├─ getEffectiveUser(user)         [cek delegasi]
 │                          ├─ canReadDocument(user, doc)     [policy engine]
 │←─ {accessible, denied} ──┤
```

### 2. Login OAuth 2.0 Google

```
User              Server              Google
 │                   │                   │
 ├─ klik Google ────→│                   │
 │                   ├── redirect ───────→│
 │                   │                   ├─ user login Google
 │                   │←── callback ───────┤  {profile, email}
 │                   ├─ cari/buat user    │
 │                   ├─ jwt.sign(user)    │
 │←── redirect ──────┤                   │
 │   /?token=<jwt>   │                   │
 │                   │                   │
 ├─ simpan token     │                   │
 └─ akses API normal │                   │
```

### 3. Alur Otorisasi per Request

```
Request masuk
     │
     ▼
[Auth Middleware]
 Verifikasi JWT
 Cek user aktif
 getEffectiveUser()  ← terapkan delegasi aktif (dept additive)
     │
     ▼
[Policy Engine]  utils/policy.js
     │
     ├─ Cek RBAC  → apakah role punya izin untuk operasi ini?
     │              Jika tidak → TOLAK
     │
     ├─ Cek ABAC  → apakah clearance mencukupi?
     │              Jika tidak → TOLAK
     │
     ├─ Cek ABAC  → apakah department sesuai?
     │              (cek user.departments[] yang bisa > 1 jika ada delegasi)
     │              Jika tidak → TOLAK
     │
     └─ IZIN → lanjutkan ke route handler
     │
     ▼
[Catat ke Audit Log]
 userId, action, resource, hasil, alasan
```

### 4. Role Delegation (ABAC Additive)

```
Kondisi normal:
  manager_it.departments = [IT]
  manager_it.clearance   = SECRET

Saat delegasi Finance aktif:
  manager_it.departments = [IT, Finance]   ← department bertambah
  manager_it.clearance   = SECRET          ← clearance TIDAK berubah

Efek:
  ✓ Bisa akses dokumen IT (hak asli)
  ✓ Bisa akses dokumen Finance ≤ SECRET (hak delegasi)
  ✗ Tidak bisa akses dokumen Finance TOP_SECRET (clearance tidak cukup)
```

### 5. Hubungan Antar Komponen

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (index.html)               │
│  Login · Documents · ABAC Simulator · Role Delegation    │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP + Bearer Token
┌────────────────────────▼────────────────────────────────┐
│                    Express Server                        │
│                                                          │
│  ┌─────────────┐    ┌──────────────────────────────┐    │
│  │Auth Middleware│──→│        Policy Engine          │    │
│  │ jwt.verify  │    │  canRead / canDelete /        │    │
│  │ getEffective│    │  canUpdate / canSensitive     │    │
│  │  User()     │    │  RBAC check + ABAC check      │    │
│  └─────────────┘    └──────────────┬───────────────┘    │
│                                    │                     │
│  ┌─────────────────────────────────▼───────────────┐    │
│  │                   Routes                         │    │
│  │  /auth  /documents  /users  /reports             │    │
│  │  /delegation  /abac                              │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   Data Store (memory)                    │
│   users[]   documents[]   delegations[]   accessLogs[]  │
└─────────────────────────────────────────────────────────┘
```

---

## Endpoint API

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login JWT |
| GET | `/api/auth/oauth/google` | Public | Redirect ke Google |
| GET | `/api/auth/oauth/google/callback` | Public | Callback OAuth |
| GET | `/api/auth/me` | Semua | Info user saat ini |
| POST | `/api/auth/logout` | Semua | Logout |
| GET | `/api/documents` | Semua | List dokumen (difilter policy) |
| GET | `/api/documents/:id` | Semua | Baca dokumen |
| POST | `/api/documents` | ADMIN/MANAGER/STAFF | Buat dokumen |
| PUT | `/api/documents/:id` | ADMIN/MANAGER/STAFF | Edit dokumen |
| DELETE | `/api/documents/:id` | ADMIN/MANAGER | Hapus dokumen |
| GET | `/api/reports/sensitive` | ADMIN/MANAGER + SECRET+ | Data sensitif |
| GET | `/api/reports/department` | ADMIN/MANAGER/STAFF | Laporan departemen |
| GET | `/api/users` | ADMIN | Daftar semua user |
| PATCH | `/api/users/:id/role` | ADMIN | Ubah role user |
| GET | `/api/users/audit-log` | ADMIN | Log akses |
| GET | `/api/delegation` | ADMIN | Daftar delegasi |
| POST | `/api/delegation` | ADMIN | Buat delegasi |
| DELETE | `/api/delegation/:id` | ADMIN | Cabut delegasi |
| POST | `/api/abac/simulate` | Semua | Simulasi keputusan ABAC |

---
#   M a n a j e m e n - D o k u m e n  
 