# Handover untuk Copilot — siDeutsch

Gunakan dokumen ini sebagai konteks awal jika sesi Copilot baru harus melanjutkan pekerjaan siDeutsch. Selalu baca file kerja terbaru sebelum mengedit; repo pernah mengalami perubahan konten yang dilakukan otomatis.

## Produk dan Arsitektur

siDeutsch adalah platform belajar bahasa Jerman untuk mahasiswa Indonesia. Jalur konten terdiri dari Alltagsdeutsch bertingkat CEFR A1–C2 dan Fachdeutsch berdasarkan jurusan. Astro menangani halaman dan SSR; Preact dipakai untuk kuis dan interaksi katalog; Supabase menyediakan Auth, database, dan Storage.

| Komponen | Implementasi |
| --- | --- |
| Framework / hosting | Astro 7 SSR, `@astrojs/vercel` |
| Interaksi | Preact 11, `@astrojs/preact` |
| Database / auth | Supabase, `@supabase/ssr`, `@supabase/supabase-js` |
| Konten | Astro Content Collections + Zod (`src/content.config.ts`) |
| Styling | CSS murni dengan CSS variables; tanpa Tailwind/Alpine |
| Node | `>=22.23.4` |

Perintah: `npm run dev`, `npm run build`, `npm run preview`. `package.json` belum punya test/lint script terpisah.

## File Penting

- `src/layouts/Layout.astro`: layout publik, SEO title/description, OG, canonical, footer, prop `hideNavbar`.
- `src/layouts/DashboardLayout.astro`: sidebar/dashboard privat.
- `src/components/Quiz.jsx`: kuis arrange/matcher/cloze, XP, nyawa, sesi lima kata, review, summary.
- `src/components/AuthPortal.astro`: UI dan client auth mahasiswa/admin.
- `src/components/DashboardMaterialCatalog.astro`, `DashboardMaterialGrid.astro`: katalog dashboard dan filter level CEFR.
- `src/pages/login.astro` dan `src/pages/admin/login.astro`: portal login terpisah.
- `src/middleware/index.ts`: Supabase session, load profil, redirect/proteksi dashboard dan admin.
- `src/pages/api/admin/users.ts`, `src/lib/admin.ts`: Admin API, authorization helper, service-role client server-side.
- `src/pages/dashboard/index.astro`: agregasi XP, sesi, daftar materi selesai, dan level dinamis.
- `src/pages/dashboard/{katalog,alltags,fach}.astro`: katalog privat SSR.
- `src/pages/materi/[slug].astro`: detail materi, tabel kosakata, guest locks, catatan, routing kembali.
- `src/pages/materi/[slug]/latihan.astro`: halaman latihan; route prerendered, Quiz di-hydrate dengan `client:load`.
- `src/content/materi/*.md`: materi; schema ada di `src/content.config.ts`.
- `src/lib/progress-client.js`: akses browser Supabase dan upsert progress.
- `supabase/user_progress.sql`, `supabase/profile_current_level.sql`: SQL setup/migrasi.

## Aturan Kerja

- Jangan menambahkan Tailwind, Alpine, atau utility CSS framework. Gunakan pola CSS dan variabel yang sudah ada: `--bg-main`, `--bg-dark`, `--accent-gold`, `--accent-red`, `--text-main`, `--card-bg`, `--border`, `--muted`.
- Jangan membaca atau mengekspos `.env`; jangan commit secret. Variabel yang dirujuk source: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Pertahankan RLS dan pemeriksaan server. Admin diverifikasi lewat `isAdminNim()` untuk `admin`/`000000`; admin login tidak membuat akun. Service-role key hanya untuk server/API admin.
- Mahasiswa memakai NIM dengan email sintetis `{NIM}@student.sideutsch.com`; signup otomatis tersedia di portal mahasiswa dan password awal = NIM.
- Guest hanya bisa membaca/mengerjakan Sesi 1. Progress guest hanya di state komponen dan hilang saat refresh. Jangan menambah local/session storage untuk guest progress.
- User login menyimpan XP/sesi/catatan ke `user_progress` per `(user_id, material_slug)` dan memakai localStorage sebagai fallback. `sessions_passed` saat ini berupa JSON array nomor sesi, misalnya `[1, 2]`.
- Level dashboard murni dari sesi Alltagsdeutsch yang lulus dan metadata CEFR: A1=10, A2=20, B1=30, B2=40, C1=50, C2=60 poin per sesi. Threshold: 0 A1 Pemula, 200 A1 Lanjut, 400 A2 Pemula, 700 A2 Lanjut, 1000 B1, 1400 B2, 1800 C1, 2200 C2 (Mastery). Fachdeutsch tanpa CEFR tidak menambah poin.
- `profiles.current_level` pernah ditambahkan melalui SQL, tetapi tidak dipakai oleh level dinamis saat ini.
- Materi baru mengikuti schema di `src/content.config.ts`: field wajib `track`, `judulMateri`, `deskripsi`, `vocab`; setiap vocab punya `german`, `indonesian`, `context`. Materi yang dibuat dalam batch terakhir diminta frontmatter-only tanpa body Markdown.
- Jangan menghapus perubahan yang bukan pekerjaanmu. Cek `git status` dan baca file sebelum perubahan.

## Status dan Next Steps

Fitur inti sudah ada: halaman materi/katalog, guest preview, kuis dan sync progress, dashboard level, login student/admin, panel CRUD, profil/avatar, serta metadata SEO.

Belum ada end-to-end verification menggunakan akun Supabase nyata pada sesi kerja ini. Untuk rilis, validasi di staging: SQL `user_progress`, RLS, Storage bucket/policies `avatars`, login student/admin, upload foto, dan sinkronisasi XP/sesi/catatan. Ada keterbatasan metadata: sebagian materi Fachdeutsch tidak memiliki `level` CEFR sehingga tidak masuk kalkulasi poin dinamis.

Verifikasi lokal utama: `npm run build`. Sesuai `AGENTS.md`, jalankan dev server dengan `astro dev --background` dan kelola dengan `astro dev status`, `astro dev logs`, atau `astro dev stop`. Dokumentasi Astro: https://docs.astro.build.
