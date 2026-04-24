# Manajemen Dokumen
### Sistem Otorisasi & Kontrol Akses — JWT · OAuth 2.0 · RBAC · ABAC

---

## Informasi Aplikasi

Manajemen Dokumen adalah aplikasi REST API berbasis web yang mendemonstrasikan implementasi sistem autentikasi dan otorisasi berlapis.

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

> `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` didapat dari [Google Cloud Console](https://console.cloud.google.com)
> → APIs & Services → Credentials → OAuth Client ID
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
│   │   ├── delegation.js     # Role delegation (ABAC additive)
│   │   └── abac.js           # ABAC simulator endpoint
│   ├── utils/
│   │   ├── jwt.js            # Generate & verify token
│   │   └── policy.js         # Engine RBAC + ABAC
│   ├── server.js             # Entry point
│   └── .env                  # Konfigurasi (buat sendiri, jangan di-commit)
├── frontend/
│   └── index.html            # Antarmuka web (single file)
├── .gitignore
├── ACCESS_POLICY.md
└── README.md
```

---

## Peran Pengguna (RBAC)

| Peran | Fungsi Dokumen | Fungsi Sistem |
|---|---|---|
| **ADMIN** | Baca, buat, edit dokumen dept sendiri. Tidak bisa hapus. | Kelola user, role, delegation, audit log |
| **MANAGER** | Baca, buat, edit, **hapus** dokumen dept sendiri | — |
| **STAFF** | Baca, buat, edit dokumen dept sendiri | — |
| **VIEWER** | Baca dokumen PUBLIC saja | — |

> Penghapusan dokumen adalah **keputusan manajerial** — hanya MANAGER yang dapat melakukannya, termasuk ADMIN IT sekalipun.

---

## Alur Autentikasi & Otorisasi

### Login JWT

```
User → POST /api/auth/login {email, password}
     ← Server verifikasi password (bcrypt)
     ← Server buat JWT {id, role, dept, clearance} berlaku 8 jam
     ← {token, user}

Setiap request selanjutnya:
User → Authorization: Bearer <token>
     → Auth Middleware: jwt.verify + getEffectiveUser (cek delegasi)
     → Policy Engine: cek RBAC + ABAC
     ← response
```

### Login OAuth 2.0 Google

```
User → klik "Continue with Google"
     → redirect ke halaman login Google
     → login dengan akun Google
     → Google redirect ke /api/auth/oauth/google/callback
     → Server buat/temukan user, generate JWT
     → redirect ke frontend dengan token
     ← user masuk sebagai VIEWER (jika akun baru)
```

### Alur Otorisasi per Request

```
Request masuk
    ↓
Auth Middleware
  · Verifikasi JWT
  · Cek user aktif
  · getEffectiveUser() → terapkan delegasi aktif (dept additive)
    ↓
Policy Engine (utils/policy.js)
  · Cek RBAC  → apakah role punya izin operasi ini?
  · Cek ABAC  → apakah clearance mencukupi?
  · Cek ABAC  → apakah dept sesuai? (cek user.departments[])
    ↓
Catat Audit Log → lanjut ke handler atau tolak
```

### Role Delegation (ABAC Additive)

```
Normal:
  manager_it.departments = [IT]
  manager_it.clearance   = SECRET

Saat delegasi Finance aktif:
  manager_it.departments = [IT, Finance]   ← bertambah
  manager_it.clearance   = SECRET          ← tidak berubah

Efek:
  ✓ Bisa akses dokumen IT (hak asli)
  ✓ Bisa akses dokumen Finance ≤ SECRET (hak delegasi)
  ✗ Tidak bisa akses dokumen Finance TOP_SECRET
```

---

## Endpoint API

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login JWT |
| GET | `/api/auth/oauth/google` | Public | Redirect ke Google |
| GET | `/api/auth/oauth/google/callback` | Public | Callback OAuth |
| GET | `/api/auth/me` | Semua | Info user aktif |
| POST | `/api/auth/logout` | Semua | Logout |
| GET | `/api/documents` | Semua | List dokumen (difilter policy) |
| GET | `/api/documents/:id` | Semua | Baca dokumen |
| POST | `/api/documents` | ADMIN/MANAGER/STAFF | Buat dokumen |
| PUT | `/api/documents/:id` | ADMIN/MANAGER/STAFF | Edit dokumen |
| DELETE | `/api/documents/:id` | MANAGER | Hapus dokumen |
| GET | `/api/users` | ADMIN | Daftar semua user |
| PATCH | `/api/users/:id/role` | ADMIN | Ubah role/atribut user |
| GET | `/api/users/audit-log` | ADMIN | Log akses |
| GET | `/api/delegation` | ADMIN | Daftar delegasi |
| POST | `/api/delegation` | ADMIN | Buat delegasi |
| DELETE | `/api/delegation/:id` | ADMIN | Cabut delegasi |

---
