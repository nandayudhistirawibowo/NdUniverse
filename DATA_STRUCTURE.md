# Struktur Data dan Komponen NdUniverse

Dokumen ini merangkum struktur source code NdUniverse untuk membantu maintenance dan handover. Struktur berikut mencerminkan isi repository saat dokumen dibuat; beberapa folder konten berisi banyak file materi, sehingga hanya contoh file yang ditampilkan.

## Gambaran Struktur `src/`

```text
src/
├── core/
│   ├── auth/
│   │   ├── admin.ts
│   │   ├── AuthPortal.astro
│   │   ├── avatar.ts
│   │   └── middleware.ts
│   ├── db/
│   │   ├── progress-client.js
│   │   └── progress-client-en.js
│   ├── game/
│   │   └── quiz-sounds.js
│   └── ui/
│       ├── DashboardLayout.astro
│       ├── DashboardLayout-de.astro
│       ├── DashboardLayout-en.astro
│       ├── DashboardMaterialCatalog.astro
│       ├── DashboardMaterialGrid.astro
│       ├── FeedbackModal.jsx
│       ├── HelpContent.astro
│       ├── HelpHint.jsx
│       └── Layout.astro
├── modules/
│   ├── english/
│   │   ├── components/
│   │   │   ├── BossFight-en.jsx
│   │   │   ├── CareerQuiz-en.jsx
│   │   │   ├── EnglishExam-en.jsx
│   │   │   ├── IELTSExam-en.jsx
│   │   │   ├── MockExam-en.jsx
│   │   │   └── Quiz-en.jsx
│   │   ├── config/
│   │   │   └── english-speech.js
│   │   └── content/
│   │       ├── everyday/a1/
│   │       │   ├── english-a1-colors.md
│   │       │   ├── english-a1-family.md
│   │       │   └── ...
│   │       ├── exam/ielts/ielts-a1-example.md
│   │       ├── exam/toefl/toefl-a1-example.md
│   │       └── alltags/ (legacy placeholder folders)
│   └── german/
│       ├── components/
│       │   ├── BossFight-de.jsx
│       │   ├── CareerQuiz-de.jsx
│       │   ├── GoetheExam-de.jsx
│       │   ├── GrammarSpeech.astro
│       │   ├── MockExam-de.jsx
│       │   └── Quiz-de.jsx
│       ├── config/
│       │   └── german-speech.js
│       └── content/
│           ├── career/
│           │   ├── business.md
│           │   ├── health.md
│           │   ├── it.md
│           │   └── nutrition.md
│           └── materi/
│               ├── alltags-a1-alam.md
│               ├── alltags-a1-angka.md
│               └── ...
├── layouts/
├── pages/
│   ├── de/
│   ├── en/
│   ├── dashboard-de/
│   ├── dashboard-en/
│   ├── login-de.astro
│   ├── login-en.astro
│   ├── index.astro
│   ├── logout.ts
│   └── ...
├── content.config.ts
├── env.d.ts
└── middleware.ts
```

## Tanggung Jawab Folder

### `src/core/`

Kode platform bersama yang dapat digunakan lintas bahasa.

- **`auth/`** — autentikasi dan akses akun, portal auth, avatar, middleware auth, serta fungsi admin. File penting: `AuthPortal.astro`, `middleware.ts`, `avatar.ts`, dan `admin.ts`.
- **`db/`** — akses dan sinkronisasi progress pengguna. `progress-client.js` menangani progress modul Jerman/default, sedangkan `progress-client-en.js` menangani progress English.
- **`ui/`** — layout dan komponen antarmuka yang dipakai oleh beberapa route atau bahasa. Layout dashboard terpisah tersedia untuk umum, German, dan English.
- **`game/`** — helper game bersama; `quiz-sounds.js` mengatur efek suara kuis.

### `src/modules/german/`

Implementasi khusus modul German. Komponen menggunakan suffix `-de` agar mudah dibedakan dari komponen English.

- **`components/`** — kuis empat pilar, Career, Goethe, Mock Exam, Boss Fight, serta komponen grammar/pengucapan. Contoh: `Quiz-de.jsx`, `BossFight-de.jsx`, `CareerQuiz-de.jsx`, `GoetheExam-de.jsx`, dan `MockExam-de.jsx`.
- **`content/`** — konten German berbasis Markdown yang dikelompokkan menjadi `materi/` dan `career/`. Contoh materi: `alltags-a1-alam.md`; contoh Career: `it.md` dan `health.md`.
- **`config/`** — konfigurasi/logic khusus German. File `german-speech.js` terkait pengaturan speech German.

### `src/modules/english/`

Modul English mengikuti struktur modular yang simetris dengan German.

- **`components/`** — komponen English untuk kuis, Career, IELTS/TOEFL Exam, dan Boss Fight, semuanya dengan suffix `-en`.
- **`content/everyday/`** — materi harian English per level CEFR; materi A1 tersedia sebagai contoh.
- **`content/exam/ielts/` dan `content/exam/toefl/`** — konten ujian per tipe, dengan contoh soal A1 untuk validasi schema.
- **`config/`** — konfigurasi speech English melalui `english-speech.js`; produksi audio/TTS masih menjadi pekerjaan lanjutan.
- Astro Content Collections memisahkan konten menjadi `englishEveryday` dan `englishExam`.

### `src/pages/`

Route Astro berbasis nama file dan struktur folder. Komponen halaman biasanya menyusun layout, mengambil konten, lalu menampilkan komponen interaktif dari `core/` atau modul bahasa.

- **`de/`** — route publik dan fitur modul German, misalnya landing `/de`, materi, ujian, Career, grammar, dan pengucapan.
- **`en/`** — route modul English, termasuk Everyday English, Academic English, Career, ujian lama, dan Exam Prep di `/en/exam/[type]/[level]`.
- **`login-de.astro` dan `login-en.astro`** — halaman login untuk pilihan bahasa masing-masing.
- **`dashboard-de/` dan `dashboard-en/`** — route dashboard authenticated beserta katalog, profil, bookmark, detail materi, dan latihan. Contoh route: `dashboard-de/materi/[slug]/latihan.astro`.
- Halaman di root `pages/` seperti `index.astro`, `bantuan.astro`, `panduan.astro`, dan `pengucapan.astro` menyediakan entry point atau route platform yang masih ada.
- Folder route lain termasuk `api/`, `admin/`, `career/`, `materi/`, `ujian/`, dan `sertifikat/`. Periksa implementasi route terkait sebelum menambah atau memindahkan URL.

Komponen universal ditempatkan di `src/core/ui/`. Folder root `src/components/` dan `src/content/` sudah tidak digunakan; komponen serta konten English berada di `src/modules/english/`.

### `src/lib/`

Folder `src/lib/` tidak ada pada struktur repository saat ini. Jika menemukan dokumentasi atau import lama yang merujuk ke folder tersebut, verifikasi sebelum mengubahnya; helper aktif berada terutama di `src/core/` dan kode khusus bahasa di `src/modules/german/`.

### File pendukung di root `src/`

- **`content.config.ts`** — konfigurasi dan schema Astro Content Collections.
- **`middleware.ts`** — middleware Astro tingkat aplikasi.
- **`env.d.ts`** — deklarasi tipe environment.

## Panduan Perubahan

- Letakkan helper lintas bahasa di `src/core/` sesuai domainnya.
- Letakkan komponen dan konten German di `src/modules/german/`.
- Letakkan komponen, config, dan konten English di `src/modules/english/`.
- Gunakan collection `englishEveryday` untuk materi sehari-hari dan `englishExam` untuk IELTS/TOEFL.
- Route ditentukan oleh struktur file `src/pages/`; periksa route dan link terkait sebelum mengubah lokasi halaman.
