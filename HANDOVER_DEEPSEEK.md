# Handover untuk DeepSeek — siDeutsch

Dokumen ini merangkum kondisi repo dan aturan kerja agar sesi baru dapat melanjutkan tanpa mengulang eksplorasi atau menimpa perubahan yang sudah ada.

## Ringkasan Produk

siDeutsch adalah platform belajar bahasa Jerman untuk mahasiswa Indonesia. Terdapat dua jalur materi: Alltagsdeutsch (CEFR A1–C2) dan Fachdeutsch (kosakata per jurusan). Materi disusun di Astro Content Collection dan latihan memakai Preact.

## Stack dan Perintah

- Astro 7 dengan SSR (`output: "server"`) dan adapter Vercel.
- Preact 11 dengan `@astrojs/preact` untuk interaksi browser.
- Supabase Auth/DB/Storage melalui `@supabase/ssr` dan `@supabase/supabase-js`.
- CSS murni; tidak menggunakan Tailwind CSS atau Alpine.js.
- Node.js minimum di `package.json`: `>=22.23.4`.
- `npm run dev`, `npm run build`, `npm run preview`.
- Repo tidak mendefinisikan script test/lint khusus; build adalah gate otomatis utama.

## Peta Folder Penting

- `src/layouts/Layout.astro`: layout publik, metadata SEO, header/footer; mendukung prop `hideNavbar`.
- `src/layouts/DashboardLayout.astro`: sidebar dan layout halaman privat mahasiswa/admin.
- `src/components/Quiz.jsx`: kuis Preact, XP, nyawa, sesi lima kata, matcher tap-to-select, summary.
- `src/components/AuthPortal.astro`: tampilan dan handler login mahasiswa/admin.
- `src/components/DashboardMaterialCatalog.astro` dan `DashboardMaterialGrid.astro`: katalog dashboard dan kartu progres materi.
- `src/pages/login.astro`, `src/pages/admin/login.astro`: dua pintu login.
- `src/middleware.ts` meneruskan ke `src/middleware/index.ts`, tempat autentikasi dan proteksi route dijalankan.
- `src/pages/dashboard/`: dashboard, profil, katalog, Alltagsdeutsch, dan Fachdeutsch.
- `src/pages/admin/` dan `src/pages/api/admin/users.ts`: panel serta API CRUD user admin.
- `src/pages/materi/[slug].astro`: detail materi, guest preview, notes/progress login, return routing.
- `src/pages/materi/[slug]/latihan.astro`: route latihan statis yang menghidrasi Quiz di browser.
- `src/content.config.ts`: schema Astro Content Collection; jangan ubah schema tanpa kebutuhan eksplisit.
- `src/content/materi/*.md`: seluruh materi.
- `src/lib/progress-client.js`, `src/lib/admin.ts`: helper Supabase.
- `supabase/user_progress.sql`, `supabase/profile_current_level.sql`: SQL setup/migrasi.

## Aturan Penting

1. Jangan menambahkan Tailwind, Alpine, atau framework CSS lain. Ikuti CSS murni dan token seperti `--bg-main`, `--bg-dark`, `--accent-gold`, `--accent-red`, `--text-main`, `--border`, dan `--muted`.
2. Jangan membaca, menyalin, atau meng-commit nilai `.env`. Nama env yang digunakan: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Service-role key hanya boleh berada di server.
3. Jangan memperlemah auth/RLS. Admin dicek server-side melalui `isAdminNim()` (`admin` dan `000000`) di middleware dan Admin API. `/admin/login` tidak melakukan signup.
4. Login mahasiswa membuat email sintetis `{NIM}@student.sideutsch.com`; akun baru dapat dibuat otomatis dan password awalnya NIM. Login admin hanya sign-in dan profilnya diverifikasi setelah autentikasi.
5. Guest quiz hanya mencoba Sesi 1 dan progress-nya in-memory; jangan menambah penyimpanan progress guest ke localStorage/sessionStorage. User login menyinkronkan progress per materi ke Supabase dengan localStorage sebagai fallback.
6. Sesi materi berisi maksimal lima kosakata. `sessions_passed` di `user_progress` berupa JSONB array nomor sesi, contohnya `[1, 2]`.
7. Level dashboard dihitung dari sesi Alltagsdeutsch yang lulus dan memiliki CEFR: A1=10, A2=20, B1=30, B2=40, C1=50, C2=60 poin per sesi. Threshold kini 0/200/400/700/1000/1400/1800/2200. Materi Fachdeutsch tanpa metadata CEFR belum menyumbang poin level.
8. File materi pada kondisi repo sekarang harus berupa frontmatter saja, berisi `track`, metadata judul/deskripsi, dan `vocab` dengan `german`, `indonesian`, `context`. Jangan menambahkan body Markdown jika tidak diminta.
9. Jangan menghapus atau mereset perubahan lokal pengguna. Periksa file sebelum mengedit.

## Data dan Setup

`user_progress` memiliki `id`, `user_id`, `material_slug`, `xp`, `sessions_passed`, `notes`, `updated_at`, serta unique key `(user_id, material_slug)`. RLS membatasi akses ke `auth.uid() = user_id`. `material_slug` mengacu ke ID konten Astro, bukan FK database.

`profiles.current_level` pernah ditambahkan lewat migrasi, tetapi level dinamis dashboard saat ini tidak memakai kolom itu. Jangan menjadikan kolom tersebut sumber kebenaran tanpa keputusan produk baru.

Sebelum uji produksi, pastikan SQL `supabase/user_progress.sql` sudah dijalankan, kebijakan Storage bucket `avatars` sudah benar, env Vercel terisi, dan RLS tabel `profiles` mengizinkan operasi profil sesuai kebijakan proyek.

## Status dan Tindak Lanjut

Fitur inti saat ini sudah terimplementasi: login terpisah, admin CRUD, katalog, guest preview, kuis, sinkronisasi progress/catatan, level dinamis, filter CEFR dashboard, dan profil/avatar.

Belum ada end-to-end test terhadap akun Supabase nyata pada sesi kerja ini. Tindak lanjut yang aman adalah memverifikasi login student/admin, RLS progress, upload avatar, dan upsert progress di environment Supabase staging. Jangan menganggap successful `npm run build` sebagai bukti akses database produksi.

## Validasi dan Panduan Repo

Jalankan `npm run build` setelah perubahan. Saat dev server perlu dijalankan, `AGENTS.md` meminta `astro dev --background`; gunakan `astro dev status/logs/stop` untuk pengelolaan server. Dokumentasi Astro resmi: https://docs.astro.build.
