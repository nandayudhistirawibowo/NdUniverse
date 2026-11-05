# siDeutsch — Product Requirements Document

**Status:** Dokumentasi kondisi implementasi saat ini  
**Produk:** Platform belajar bahasa Jerman untuk mahasiswa Indonesia

## Latar Belakang

Mahasiswa membutuhkan jalur belajar bahasa Jerman yang terstruktur, relevan dengan kehidupan sehari-hari maupun bidang studi, dan dapat dilanjutkan secara bertahap. siDeutsch menyediakan katalog kosakata, latihan interaktif, akun mahasiswa, serta penyimpanan progress lintas perangkat melalui Supabase.

## Tujuan Produk

- Membantu mahasiswa mempelajari bahasa Jerman dari level CEFR A1 sampai C2.
- Menyediakan Alltagsdeutsch untuk bahasa sehari-hari dan Fachdeutsch untuk kosakata bidang studi.
- Membentuk kebiasaan belajar lewat sesi pendek, kuis, XP, nyawa, dan progress yang tersimpan untuk user login.
- Memberi admin jalur khusus untuk mengelola akun mahasiswa.

## Target User

### Mahasiswa

Mahasiswa Indonesia yang ingin belajar bahasa Jerman secara mandiri, dari dasar hingga tingkat lanjut, termasuk kosakata yang berhubungan dengan jurusan.

### Admin

Pengelola yang membuat, melihat, memperbarui, dan menghapus akun mahasiswa melalui panel terproteksi.

## Fitur Utama

### Autentikasi NIM

- Mahasiswa masuk menggunakan NIM; email Supabase dibentuk sebagai `{NIM}@student.sideutsch.com`.
- Jika akun mahasiswa belum ada, portal mahasiswa dapat mendaftarkannya otomatis dengan password awal berupa NIM. Konfirmasi email Supabase harus dikonfigurasi agar sesuai dengan alur ini.
- Login mahasiswa berada di `/login`. NIM admin ditolak di portal ini.
- Portal admin berada di `/admin/login`, tidak melakukan signup, dan memeriksa NIM pada profil setelah autentikasi.
- Daftar NIM admin yang diakui kode saat ini adalah `admin` dan `000000`. Otorisasi server tetap dilakukan di middleware/API; URL terpisah bukan pengganti otorisasi.

### Dual-Track Materi

- **Alltagsdeutsch:** materi umum berlabel CEFR A1, A2, B1, B2, C1, atau C2.
- **Fachdeutsch:** kosakata bidang studi/jurusan. Metadata level CEFR bersifat opsional dan belum tersedia pada semua materi Fachdeutsch.
- Materi didefinisikan sebagai Astro Content Collection dengan `track`, `judulMateri`, `deskripsi`, dan array `vocab`.
- Setiap kosakata memiliki `german`, `indonesian`, dan `context` (contoh kalimat).
- Detail materi dibagi menjadi sesi berisi maksimal lima kata.

### Kuis dan Progress

- Tipe soal: susun kata, tap-to-select word matcher, dan cloze.
- User memulai dengan tiga nyawa. Jawaban salah mengurangi nyawa; jawaban benar memberikan 10 XP.
- Sesi dianggap lulus jika akurasi mencapai minimal 80% (empat dari lima jawaban benar untuk sesi penuh).
- Kuis menampilkan ringkasan skor dan kata yang perlu diulang.
- Untuk user login, XP dan sesi disimpan per materi di `user_progress` Supabase. `localStorage` menjadi fallback lokal.
- Guest dapat mencoba Sesi 1. Sesi lain dikunci; XP dan progress guest hanya berada di memori dan hilang saat halaman dimuat ulang.
- Catatan materi hanya tersedia bagi user login dan disinkronkan per materi.

### Level Bahasa Dinamis

Level dashboard dihitung dari jumlah sesi lulus per materi Alltagsdeutsch yang memiliki metadata CEFR. Setiap sesi lulus bernilai:

| Level materi | Poin per sesi lulus |
| --- | ---: |
| A1 | 10 |
| A2 | 20 |
| B1 | 30 |
| B2 | 40 |
| C1 | 50 |
| C2 | 60 |

| Total poin | Level dashboard |
| --- | --- |
| 0–199 | A1 Pemula |
| 200–399 | A1 Lanjut |
| 400–699 | A2 Pemula |
| 700–999 | A2 Lanjut |
| 1000–1399 | B1 |
| 1400–1799 | B2 |
| 1800–2199 | C1 |
| 2200 ke atas | C2 (Mastery) |

Progress bar menunjukkan rasio poin saat ini terhadap threshold level berikutnya, maksimal 100%. Level tidak ditentukan oleh placement test atau kolom `profiles.current_level`. Materi tanpa level CEFR, termasuk Fachdeutsch yang belum memiliki metadata level, tidak menambah poin level.

### Profil dan Admin

- Profil mahasiswa menampilkan NIM, nama, dan foto profil. Foto disimpan di bucket Supabase Storage `avatars`; URL publiknya dicatat di `profiles.avatar_url`.
- Admin mengelola akun melalui `/admin` dan endpoint `/api/admin/users`.
- Endpoint admin memakai service-role client di sisi server dan memeriksa identitas admin.

## Tech Stack

| Area | Teknologi |
| --- | --- |
| Framework | Astro 7, SSR (`output: "server"`) |
| Adapter / hosting | `@astrojs/vercel`, Vercel |
| UI interaktif | Preact 11, `@astrojs/preact` |
| Styling | CSS murni, CSS variables; tanpa Tailwind dan Alpine.js |
| Auth dan database | Supabase Auth, `@supabase/ssr`, `@supabase/supabase-js` |
| Konten | Astro Content Collections, Markdown frontmatter tervalidasi Zod |
| Runtime proyek | Node.js `>=22.23.4` |

Tema utama menggunakan `--bg-main`, `--bg-dark`, `--accent-gold`, `--accent-red`, `--text-main`, `--card-bg`, `--border`, dan `--muted`.

## Arsitektur Data

- `auth.users` dikelola Supabase Auth dan menjadi identitas akun.
- `profiles` menyimpan profil aplikasi, termasuk NIM, nama, nomor WhatsApp (kolom masih digunakan beberapa area admin/status), dan URL avatar. Kolom `current_level` pernah ditambahkan lewat migrasi, tetapi level dashboard saat ini dihitung dinamis dan tidak membaca kolom tersebut.
- `user_progress` menyimpan satu baris per user dan slug materi: XP, sesi lulus sebagai JSONB, catatan, dan waktu pembaruan. Constraint unik `(user_id, material_slug)` dipakai sebagai target upsert.
- `material_slug` mengacu secara logis pada ID Astro Content Collection; bukan foreign key tabel database.
- RLS membatasi baca/tulis `user_progress` ke `auth.uid() = user_id`.
- SQL setup tersedia di `supabase/user_progress.sql` dan `supabase/profile_current_level.sql`.

## Persyaratan Operasional

- Variabel lingkungan yang dipakai kode: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`. Jangan commit nilai rahasia.
- Bucket Storage `avatars`, kebijakan akses Storage, RLS, serta SQL Supabase harus sudah diterapkan untuk mengaktifkan alur produksi.
- Build produksi: `npm run build`.
- Belum ada script test otomatis di `package.json`; verifikasi utama saat ini adalah build dan uji manual/browser.
