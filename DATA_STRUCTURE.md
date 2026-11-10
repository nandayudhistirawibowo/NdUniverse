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
├── components/
│   ├── BossFight-en.jsx
│   ├── CareerQuiz-en.jsx
│   ├── IELTSExam-en.jsx
│   ├── MockExam-en.jsx
│   └── Quiz-en.jsx
├── content/
│   └── en/
│       └── alltags/
│           └── a1/
│               ├── english-a1-colors.md
│               ├── english-a1-family.md
│               ├── english-a1-food.md
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

### `src/pages/`

Route Astro berbasis nama file dan struktur folder. Komponen halaman biasanya menyusun layout, mengambil konten, lalu menampilkan komponen interaktif dari `core/` atau modul bahasa.

- **`de/`** — route publik dan fitur modul German, misalnya landing `/de`, materi, ujian, Career, grammar, dan pengucapan.
- **`en/`** — route modul English, misalnya `/en`, Everyday English, Academic English, Career, dan ujian English. Modul ini masih dalam pengembangan.
- **`login-de.astro` dan `login-en.astro`** — halaman login untuk pilihan bahasa masing-masing.
- **`dashboard-de/` dan `dashboard-en/`** — route dashboard authenticated beserta katalog, profil, bookmark, detail materi, dan latihan. Contoh route: `dashboard-de/materi/[slug]/latihan.astro`.
- Halaman di root `pages/` seperti `index.astro`, `bantuan.astro`, `panduan.astro`, dan `pengucapan.astro` menyediakan entry point atau route platform yang masih ada.
- Folder route lain termasuk `api/`, `admin/`, `career/`, `materi/`, `ujian/`, dan `sertifikat/`. Periksa implementasi route terkait sebelum menambah atau memindahkan URL.

### `src/components/`

Komponen bahasa English dan komponen yang belum dipindahkan ke struktur modul khusus. File yang ada saat ini meliputi `Quiz-en.jsx`, `BossFight-en.jsx`, `CareerQuiz-en.jsx`, `MockExam-en.jsx`, dan `IELTSExam-en.jsx`. Komponen platform universal ditempatkan di `src/core/ui/`, bukan di folder ini.

### `src/content/`

Konten English berbasis Markdown yang dikelola sebagai Astro Content Collections. Contoh yang tersedia saat ini berada di `en/alltags/a1/`, seperti `english-a1-colors.md`, `english-a1-family.md`, dan `english-a1-food.md`. Konten German disimpan terpisah di `src/modules/german/content/`.

### `src/lib/`

Folder `src/lib/` tidak ada pada struktur repository saat ini. Jika menemukan dokumentasi atau import lama yang merujuk ke folder tersebut, verifikasi sebelum mengubahnya; helper aktif berada terutama di `src/core/` dan kode khusus bahasa di `src/modules/german/`.

### File pendukung di root `src/`

- **`content.config.ts`** — konfigurasi dan schema Astro Content Collections.
- **`middleware.ts`** — middleware Astro tingkat aplikasi.
- **`env.d.ts`** — deklarasi tipe environment.

## Panduan Perubahan

- Letakkan helper lintas bahasa di `src/core/` sesuai domainnya.
- Letakkan komponen dan konten German di `src/modules/german/`.
- Pertahankan komponen English dengan suffix `-en` di `src/components/` selama belum dipindahkan ke struktur modul khusus.
- Letakkan Markdown konten English pada collection yang sesuai di `src/content/en/`.
- Route ditentukan oleh struktur file `src/pages/`; periksa route dan link terkait sebelum mengubah lokasi halaman.
