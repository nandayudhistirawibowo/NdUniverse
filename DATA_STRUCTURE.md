# Struktur Data dan Komponen NdUniverse

Dokumen ini merangkum struktur source code NdUniverse untuk membantu maintenance dan handover. Struktur berikut mencerminkan isi repository saat ini; beberapa folder konten berisi banyak file materi, sehingga hanya contoh file yang ditampilkan.

UI menggunakan Bahasa Indonesia secara hardcoded (Indonesian-first) tanpa sistem i18n. Tautan `/en` dan `/de` hanya navigasi antar modul pembelajaran, bukan pengubah bahasa antarmuka.

## Gambaran Struktur `src/`

```text
src/
├── core/
│   ├── auth/
│   │   ├── admin.ts
│   │   ├── AuthPortal.astro
│   │   ├── avatar.ts
│   │   └── middleware.ts
│   ├── audio/
│   │   ├── boss-audio.js
│   │   └── cdn-audio.js
│   ├── db/
│   │   ├── progress-client.js
│   │   └── progress-client-en.js
│   ├── game/
│   │   ├── exam-grading.js
│   │   ├── fuzzy-match.js
│   │   ├── quiz-sounds.js
│   │   └── useExamAntiCheat.js
│   └── ui/
│       ├── DashboardLayout.astro
│       ├── DashboardLayout-de.astro
│       ├── DashboardLayout-en.astro
│       ├── DashboardMaterialCatalog.astro
│       ├── DashboardMaterialGrid.astro
│       ├── FeedbackModal.jsx
│       ├── HelpContent.astro
│       ├── HelpHint.jsx
│       ├── Layout.astro
│       └── NdBot.jsx
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
│   │       ├── academic/
│   │       ├── career/
│   │       └── exam/
│   │           ├── ielts/
│   │           └── toefl/
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
- **`audio/`** — pembentukan URL dan pemutaran audio CDN, termasuk voice acting Boss Fight.
- **`ui/`** — layout dan komponen antarmuka yang dipakai oleh beberapa route atau bahasa. Layout dashboard terpisah tersedia untuk umum, German, dan English.
- **`game/`** — helper bersama untuk suara kuis, fuzzy matching, grading ujian, dan anti-cheat fullscreen.

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
- **`config/`** — konfigurasi speech English melalui `english-speech.js`; generator TTS mendukung aksen US/UK, dengan resolver CDN sinkron di `src/core/audio/cdn-audio.js`.
- Astro Content Collections English mencakup `englishEveryday`, `englishAcademic`, `englishCareer`, dan `englishExam`.

### `src/pages/`

Route Astro berbasis nama file dan struktur folder. Komponen halaman biasanya menyusun layout, mengambil konten, lalu menampilkan komponen interaktif dari `core/` atau modul bahasa.

- **`de/`** — route publik dan fitur modul German, misalnya landing `/de`, materi, ujian, Career, grammar, dan pengucapan.
- **`en/`** — route modul English, termasuk dashboard, materi, Everyday English, Academic English, Career, Grammar, Pronunciation, dan Exam Prep di `/en/exam/[type]/[level]`.
- **`login-de.astro` dan `login-en.astro`** — halaman login untuk pilihan bahasa masing-masing.
- **`dashboard-de/`** — route dashboard German aktif dengan halaman utama, profil, dan bookmark, pada URL `/dashboard-de`. Katalog, detail materi, dan latihan German berada di bawah `/de/...`. Dashboard English berada di `pages/en/dashboard/` pada URL `/en/dashboard`.
- Root `pages/` berisi landing, login, dan dashboard umum. Halaman bantuan dan pengucapan berada di bawah route modul (`/de/...` atau `/en/...`), bukan sebagai halaman root.
- Folder route lain termasuk `api/`, `admin/`, `career/`, `materi/`, `ujian/`, dan `sertifikat/`. Periksa implementasi route terkait sebelum menambah atau memindahkan URL.

Komponen universal ditempatkan di `src/core/ui/`. Folder root `src/components/` dan `src/content/` sudah tidak digunakan; komponen serta konten English berada di `src/modules/english/`.

### File pendukung di root `src/`

- **`content.config.ts`** — konfigurasi dan schema Astro Content Collections.
- **`middleware.ts`** — middleware Astro tingkat aplikasi.
- **`env.d.ts`** — deklarasi tipe environment.

## Panduan Perubahan

- Letakkan helper lintas bahasa di `src/core/` sesuai domainnya.
- Letakkan komponen dan konten German di `src/modules/german/`.
- Letakkan komponen, config, dan konten English di `src/modules/english/`.
- Gunakan collection yang sesuai dengan domain: `englishEveryday`, `englishAcademic`, `englishCareer`, atau `englishExam`.
- Route ditentukan oleh struktur file `src/pages/`; periksa route dan link terkait sebelum mengubah lokasi halaman.
