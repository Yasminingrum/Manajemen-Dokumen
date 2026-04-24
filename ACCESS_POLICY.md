# ACCESS POLICY DOCUMENT
## SecureAccess — JWT + OAuth2 + RBAC + ABAC System

---

## 1. DEFINISI PERAN (RBAC)

| Peran   | Deskripsi                                               |
|---------|--------------------------------------------------------|
| ADMIN   | Administrator sistem dengan akses penuh                 |
| MANAGER | Manajer departemen, akses level departemen             |
| STAFF   | Karyawan operasional, akses terbatas dalam departemen  |
| VIEWER  | Pengamat, hanya bisa membaca konten publik             |

---

## 2. ATRIBUT PENGGUNA (ABAC — User Attributes)

| Atribut        | Nilai yang Mungkin                              | Fungsi                                      |
|----------------|------------------------------------------------|---------------------------------------------|
| role           | ADMIN, MANAGER, STAFF, VIEWER                  | Menentukan hak akses dasar (RBAC)           |
| department     | IT, Finance, HR, Marketing, General            | Menentukan batasan akses lintas departemen  |
| clearanceLevel | PUBLIC, CONFIDENTIAL, SECRET, TOP_SECRET       | Menentukan tingkat dokumen yang dapat diakses |
| isActive       | true / false                                   | Menentukan apakah akun masih aktif          |

---

## 3. ATRIBUT DATA/DOKUMEN (ABAC — Resource Attributes)

| Atribut        | Nilai yang Mungkin                              | Fungsi                                      |
|----------------|------------------------------------------------|---------------------------------------------|
| department     | IT, Finance, HR, Marketing, General            | Menentukan kepemilikan departemen dokumen   |
| classification | PUBLIC, CONFIDENTIAL, SECRET, TOP_SECRET       | Menentukan tingkat kerahasiaan dokumen      |
| ownerId        | UUID pengguna                                   | Menentukan pemilik dokumen                  |

---

## 4. HIERARKI CLEARANCE LEVEL

```
TOP_SECRET  ← tertinggi (dapat akses semua level)
    ↑
  SECRET    ← dapat akses PUBLIC, CONFIDENTIAL, SECRET
    ↑
CONFIDENTIAL ← dapat akses PUBLIC, CONFIDENTIAL
    ↑
  PUBLIC    ← terendah (hanya akses PUBLIC)
```

Aturan: User dapat mengakses dokumen jika clearanceLevel(user) ≥ classification(dokumen)

---

## 5. ACCESS POLICY MATRIX

### 5.1 Kebijakan Berdasarkan Operasi

#### CREATE DOCUMENT
- **RBAC:** Role ≠ VIEWER
- **ABAC:** Dokumen otomatis dibuat dengan department = user.department
- **Hasil:** ADMIN, MANAGER, STAFF = DIIZINKAN; VIEWER = DITOLAK

#### READ DOCUMENT
- **RBAC:** Semua role dapat membaca (dengan kondisi)
- **ABAC Kondisi 1:** user.clearanceLevel ≥ document.classification
- **ABAC Kondisi 2:** user.role = ADMIN ATAU user.department = document.department ATAU document.classification = PUBLIC
- **Formula:** `clearanceOK AND (isAdmin OR sameDept OR isPublic)`

#### UPDATE DOCUMENT
- **RBAC:** Role ∈ {ADMIN, MANAGER, STAFF}
- **ABAC:** user.clearanceLevel ≥ document.classification AND user.department = document.department
- **Pengecualian:** ADMIN tidak memerlukan syarat ABAC

#### DELETE DOCUMENT ← Contoh RBAC+ABAC Kombinasi
- **RBAC:** Role ∈ {ADMIN, MANAGER} saja
- **ABAC:** MANAGER harus user.department = document.department
- **Pengecualian:** ADMIN dapat menghapus dokumen lintas departemen
- **Formula:**
  ```
  IF role = ADMIN → DIIZINKAN
  IF role = MANAGER AND user.department = doc.department → DIIZINKAN
  IF role = MANAGER AND user.department ≠ doc.department → DITOLAK
  IF role ∈ {STAFF, VIEWER} → DITOLAK
  ```

#### ACCESS SENSITIVE DATA ← Contoh RBAC+ABAC Kombinasi
- **RBAC:** Role ∈ {ADMIN, MANAGER}
- **ABAC:** user.clearanceLevel ∈ {SECRET, TOP_SECRET}
- **Formula:** `(role=ADMIN OR role=MANAGER) AND clearanceRank(user.clearance) ≥ clearanceRank(SECRET)`
- **Catatan:** MANAGER dengan clearance CONFIDENTIAL tetap DITOLAK meski rolenya sesuai

#### MANAGE USERS
- **RBAC Only:** role = ADMIN
- **ABAC:** Tidak diperlukan
- **Hasil:** Hanya ADMIN = DIIZINKAN; semua lain = DITOLAK

#### VIEW AUDIT LOG
- **RBAC Only:** role = ADMIN
- **ABAC:** Tidak diperlukan
- **Hasil:** Hanya ADMIN = DIIZINKAN

---

## 6. CONTOH SKENARIO KEPUTUSAN OTORISASI

### Skenario A: Penghapusan Dokumen Lintas Departemen
```
User:     manager@company.com (role=MANAGER, dept=Finance)
Dokumen:  IT Infrastructure Plan (dept=IT, class=TOP_SECRET)
Operasi:  DELETE

Evaluasi:
  RBAC → role=MANAGER → memiliki izin delete secara role ✓
  ABAC → user.dept(Finance) ≠ doc.dept(IT) → kondisi gagal ✗

Hasil: DITOLAK
Alasan: "MANAGER dapat menghapus hanya dokumen dari departemennya sendiri (Finance). Dokumen ini milik IT."
```

### Skenario B: Penghapusan Dokumen Departemen Sendiri
```
User:     manager@company.com (role=MANAGER, dept=Finance)
Dokumen:  Q4 Financial Report (dept=Finance, class=SECRET)
Operasi:  DELETE

Evaluasi:
  RBAC → role=MANAGER → ✓
  ABAC → user.dept(Finance) = doc.dept(Finance) → ✓

Hasil: DIIZINKAN
Alasan: "RBAC(MANAGER) + ABAC(same department: Finance)"
```

### Skenario C: Akses Data Sensitif
```
User A:  manager@company.com (role=MANAGER, clearance=SECRET)
User B:  staff@company.com (role=STAFF, clearance=CONFIDENTIAL)
Operasi: ACCESS_SENSITIVE_DATA

User A Evaluasi:
  RBAC → role=MANAGER → ✓
  ABAC → clearance(SECRET) ≥ SECRET → ✓
  Hasil: DIIZINKAN

User B Evaluasi:
  RBAC → role=STAFF → ✗ (harus ADMIN atau MANAGER)
  Hasil: DITOLAK (RBAC sudah gagal, ABAC tidak dievaluasi)
```

### Skenario D: Akses Dokumen dengan Clearance Tidak Cukup
```
User:     staff@company.com (role=STAFF, dept=HR, clearance=CONFIDENTIAL)
Dokumen:  Salary Structure (dept=Finance, class=TOP_SECRET)
Operasi:  READ

Evaluasi:
  ABAC → clearance(CONFIDENTIAL) < classification(TOP_SECRET) → ✗

Hasil: DITOLAK
Alasan: "Clearance CONFIDENTIAL tidak mencukupi untuk dokumen TOP_SECRET"
```

---

## 7. KEBIJAKAN AUTENTIKASI

### JWT Authentication
- Token berlaku 8 jam sejak login
- Payload mengandung: id, email, username, role, department, clearanceLevel
- Setiap request API harus menyertakan: `Authorization: Bearer <token>`

### OAuth 2.0 (Google)
- User baru yang login via OAuth otomatis diberi role VIEWER
- Department default: General
- Clearance default: PUBLIC
- Admin dapat mengubah role OAuth user setelah verifikasi

---

## 8. LOGGING & AUDIT

Setiap keputusan otorisasi dicatat dengan:
- Timestamp
- User ID & Username
- Action yang dilakukan
- Resource yang diakses
- Hasil: ALLOWED / DENIED
- Alasan keputusan

Audit log hanya dapat diakses oleh ADMIN (RBAC Only).
