# ACCESS POLICY DOCUMENT
## Manajemen Dokumen — Sistem Otorisasi RBAC + ABAC
### Universitas Ciputra — Tugas Keamanan Informasi

---

## 1. Peran Pengguna (RBAC)

| Peran | Deskripsi |
|---|---|
| **ADMIN** | Pegawai IT yang juga mengelola sistem. Untuk dokumen, diperlakukan seperti pegawai biasa di departemennya. Tidak memiliki hak hapus dokumen. |
| **MANAGER** | Manajer departemen. Satu-satunya peran yang dapat menghapus dokumen — penghapusan adalah keputusan manajerial. |
| **STAFF** | Pegawai operasional. Dapat membaca, membuat, dan mengedit dokumen di departemennya. |
| **VIEWER** | Pengamat atau tamu. Hanya dapat membaca dokumen PUBLIC. |

---

## 2. Atribut Pengguna (ABAC)

| Atribut | Nilai | Keterangan |
|---|---|---|
| `role` | ADMIN, MANAGER, STAFF, VIEWER | Menentukan hak akses dasar (RBAC) |
| `department` | IT, Finance, HR, General | Departemen asal user. Dapat bertambah jika menerima delegasi aktif. |
| `clearanceLevel` | PUBLIC, CONFIDENTIAL, SECRET, TOP_SECRET | Tingkat izin akses. Tidak berubah saat delegasi. |
| `isActive` | true / false | Akun nonaktif tidak dapat login meski token masih berlaku. |

---

## 3. Atribut Dokumen (ABAC)

| Atribut | Nilai | Keterangan |
|---|---|---|
| `department` | IT, Finance, HR, General | Departemen pemilik dokumen |
| `classification` | PUBLIC, CONFIDENTIAL, SECRET, TOP_SECRET | Tingkat kerahasiaan dokumen |

---

## 4. Hierarki Clearance Level

```
TOP_SECRET   → dapat akses: PUBLIC, CONFIDENTIAL, SECRET, TOP_SECRET
SECRET       → dapat akses: PUBLIC, CONFIDENTIAL, SECRET
CONFIDENTIAL → dapat akses: PUBLIC, CONFIDENTIAL
PUBLIC       → dapat akses: PUBLIC saja
```

Aturan: `clearanceRank(user) >= clearanceRank(dokumen)` → boleh akses

---

## 5. Kebijakan Akses per Operasi

### BACA DOKUMEN

```
RBAC : semua role (dengan syarat ABAC)
ABAC : clearance user >= classification dokumen
       DAN department user mencakup department dokumen
       KECUALI dokumen PUBLIC → semua role boleh baca
```

### BUAT DOKUMEN

```
RBAC : ADMIN, MANAGER, STAFF
       VIEWER tidak boleh
ABAC : dokumen otomatis masuk ke department user yang login
```

### EDIT DOKUMEN

```
RBAC : ADMIN, MANAGER, STAFF
       VIEWER tidak boleh
ABAC : clearance user >= classification dokumen
       DAN department sesuai
```

### HAPUS DOKUMEN ← Keputusan Manajerial

```
RBAC : MANAGER saja
       ADMIN tidak boleh (meski dokumen dept sendiri)
       STAFF tidak boleh
       VIEWER tidak boleh
ABAC : clearance user >= classification dokumen
       DAN department sesuai (termasuk dept dari delegasi aktif)
```

> **Alasan desain:** Penghapusan dokumen adalah tindakan permanen yang berdampak pada operasional. Keputusan ini harus ada di tangan manajer agar ada akuntabilitas manajerial. Admin IT tidak dilibatkan untuk menjaga pemisahan tanggung jawab (*separation of duties*).

### KELOLA PENGGUNA, ROLE DELEGATION, AUDIT LOG

```
RBAC : ADMIN saja
ABAC : tidak diperlukan
```

---

## 6. Role Delegation

Delegasi adalah mekanisme di mana ADMIN memberikan akses **department tambahan** kepada user lain untuk sementara waktu — misalnya saat seorang manajer sedang cuti.

**Yang didelegasikan:** department saja
**Yang tidak didelegasikan:** clearance level (tetap milik jabatan asli)
**Siapa yang bisa membuat delegasi:** ADMIN

### Contoh Skenario

```
Manager Finance (SECRET) sedang cuti 3 hari.
ADMIN mendelegasikan dept Finance ke Manager IT (SECRET).

Sebelum delegasi:
  Manager IT → departments: [IT], clearance: SECRET

Setelah delegasi aktif:
  Manager IT → departments: [IT, Finance], clearance: SECRET

Efek:
  ✓ Tetap bisa akses dokumen IT (hak asli)
  ✓ Bisa akses dokumen Finance ≤ SECRET (hak delegasi)
  ✗ Tidak bisa akses dokumen Finance TOP_SECRET
    → clearance SECRET tidak mencukupi, meski dept sudah ada
```

---

## 7. Matriks Hak Akses

| Operasi | ADMIN | MANAGER | STAFF | VIEWER | Syarat ABAC |
|---|---|---|---|---|---|
| Baca dokumen | ✓ | ✓ | ✓ | ◐ | clearance ≥ classification AND dept sesuai |
| Buat dokumen | ✓ | ✓ | ✓ | ✗ | dept dokumen = dept user |
| Edit dokumen | ✓ | ✓ | ✓ | ✗ | clearance ≥ classification AND dept sesuai |
| Hapus dokumen | ✗ | ✓ | ✗ | ✗ | clearance ≥ classification AND dept sesuai |
| Kelola user | ✓ | ✗ | ✗ | ✗ | — |
| Role Delegation | ✓ | ✗ | ✗ | ✗ | — |
| Audit Log | ✓ | ✗ | ✗ | ✗ | — |

> ✓ = selalu diizinkan &nbsp;|&nbsp; ✗ = selalu ditolak &nbsp;|&nbsp; ◐ = hanya dokumen PUBLIC

---

## 8. Contoh Keputusan Otorisasi (RBAC + ABAC)

| Skenario | RBAC | ABAC | Hasil |
|---|---|---|---|
| Admin IT baca dok IT (SECRET) | ADMIN ✓ | dept IT ✓, clearance TOP_SECRET ≥ SECRET ✓ | **IZIN** |
| Admin IT baca dok Finance (SECRET) | ADMIN ✓ | dept IT ≠ Finance ✗ | **TOLAK** |
| Admin IT hapus dok IT | ADMIN ✗ | — | **TOLAK** — keputusan manajerial |
| Manager Finance hapus dok Finance (SECRET) | MANAGER ✓ | dept Finance ✓, clearance SECRET ≥ SECRET ✓ | **IZIN** |
| Manager Finance hapus dok IT (SECRET) | MANAGER ✓ | dept Finance ≠ IT ✗ | **TOLAK** |
| Manager Finance hapus dok Finance (TOP_SECRET) | MANAGER ✓ | clearance SECRET < TOP_SECRET ✗ | **TOLAK** |
| Staff HR baca dok Finance (SECRET) | STAFF ✓ | dept HR ≠ Finance ✗ | **TOLAK** |
| Staff HR baca dok HR (CONFIDENTIAL) | STAFF ✓ | dept HR ✓, clearance CONF ≥ CONF ✓ | **IZIN** |
| Viewer baca dok PUBLIC | VIEWER ✓ | classification=PUBLIC ✓ | **IZIN** |
| Viewer baca dok CONFIDENTIAL | VIEWER ✗ | — | **TOLAK** |
| Manager IT (delegasi Finance) hapus dok Finance (SECRET) | MANAGER ✓ | dept Finance via delegasi ✓, clearance SECRET ≥ SECRET ✓ | **IZIN** |
| Manager IT (delegasi Finance) hapus dok Finance (TOP_SECRET) | MANAGER ✓ | clearance SECRET < TOP_SECRET ✗ | **TOLAK** |

---

## 9. Kebijakan Autentikasi

### JWT

- Token ditandatangani dengan `JWT_SECRET` menggunakan algoritma HS256
- Masa berlaku: 8 jam sejak login
- Payload berisi: `id`, `email`, `username`, `role`, `department`, `clearanceLevel`
- Setiap request API wajib menyertakan: `Authorization: Bearer <token>`
- Token yang kadaluarsa atau dipalsukan akan ditolak dengan HTTP 401

### OAuth 2.0 Google

- User baru yang login via Google otomatis terdaftar sebagai **VIEWER**
- Department default: General
- Clearance default: PUBLIC
- Admin dapat mengubah role dan atribut user OAuth setelah verifikasi identitas

---

## 10. Audit Log

Setiap keputusan otorisasi dicatat secara otomatis dengan informasi:

| Field | Keterangan |
|---|---|
| `timestamp` | Waktu kejadian (ISO 8601) |
| `userId` | ID user yang melakukan aksi |
| `username` | Nama user |
| `action` | Jenis aksi (LOGIN, READ_DOCUMENT, DELETE_DOCUMENT, dst.) |
| `resource` | Resource yang diakses |
| `result` | ALLOWED atau DENIED |
| `reason` | Alasan keputusan dari policy engine |

Audit log hanya dapat diakses oleh ADMIN.
