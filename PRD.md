# siDeutsch — Product Requirements Document

**Status:** Dokumentasi kondisi implementasi saat ini  
**Produk:** Platform belajar bahasa Jerman untuk siapa saja

## Latar Belakang

siDeutsch adalah platform belajar bahasa Jerman interaktif untuk siapa saja yang ingin meningkatkan kemampuan bahasa, dari komunikasi sehari-hari hingga kosakata bidang profesional. Produk menyediakan materi bertingkat A1–C2, kuis, progress, bookmark kosakata, dan materi persiapan kerja.

Koleksi saat ini terdiri dari **411 materi Alltagsdeutsch A1–C2 (8.220 vocab)**, **13 materi Fachdeutsch (260 vocab)**, dan **1 materi Career (20 vocab)**: total **425 file materi dan sekitar 8.500 entri vocab**.

## Tujuan dan Pengguna

- Membantu pelajar/pengguna umum belajar bahasa Jerman dari A1 hingga C2.
- Menyediakan Alltagsdeutsch, Fachdeutsch, dan materi Career untuk komunikasi dunia kerja.
- Memberikan sesi kuis singkat, XP, bookmark kosakata, dan progress tersinkron untuk pengguna yang masuk.
- Menjaga area profil, dashboard, Career, Bantuan, dan admin tetap terproteksi autentikasi.

Target utama adalah **pelajar dan pengguna umum**. Admin mengelola akun dan platform melalui portal terpisah.

## Fitur Utama

### Autentikasi dan Akses

- Halaman `/login` menerima email atau NIM lama. NIM lama dipetakan ke alamat Supabase `NIM@student.sideutsch.com`; alamat email digunakan langsung.
- Pengguna baru tidak memerlukan tombol Daftar. Jika upaya login mendapat `Invalid login credentials`, aplikasi mencoba membuat akun otomatis (*auto-signup*) menggunakan email dan password yang dimasukkan, lalu mencoba masuk kembali.
- Profil pengguna umum dibuat dengan `nim` nullable jika pengguna tidak memiliki NIM. Akun NIM lama tetap dapat digunakan.
- Jika akun sudah terdaftar tetapi password salah, pengguna menerima pesan yang menjelaskan kondisi tersebut. Konfirmasi email Supabase yang aktif dapat menghalangi login otomatis hingga email dikonfirmasi.
- Admin menggunakan `/admin/login` dengan validasi dan otorisasi khusus.
- Middleware melindungi `/dashboard`, `/career`, dan `/bantuan`; rute admin memerlukan hak admin.
- Materi publik dapat dilihat tanpa login; dashboard dan sinkronisasi progress memerlukan akun yang masuk.

### Materi dan Jalur Belajar

- **Alltagsdeutsch:** materi bahasa umum berdasarkan level CEFR A1–C2.
- **Fachdeutsch:** kosakata dan konteks berbagai bidang studi/profesional.
- **Career:** track persiapan kerja terpisah tanpa level CEFR. Halaman katalog `/career` saat ini menampilkan pemberitahuan Coming Soon; kuis Career belum tersedia.
- Materi Alltagsdeutsch dan Fachdeutsch berada di content collection `materi`; Career berada di collection `career`.
- Materi utama memuat track, level atau bidang bila sesuai, judul, deskripsi, dan vocab. Vocab menyediakan kata Jerman, arti Indonesia, kalimat konteks Jerman, dan terjemahan konteks.
- Vocab materi utama dibagi ke sesi latihan maksimal lima kata.

### Kuis, XP, dan Progress

- Kuis materi utama menggunakan variasi Tap & Arrange (Susun Kata), Word Matcher, dan Text Box.
- Setiap kuis dimulai dengan tiga nyawa. Jawaban salah mengurangi nyawa dan menambahkan kata terkait ke Review Kata Sulit.
- Jawaban benar menambah 10 XP ke state XP sementara. XP baru ditambahkan ke total setelah semua soal sesi selesai; jika Game Over, XP sementara dibuang dan tidak dikomit. Mekanisme ini mencegah XP dari sesi yang tidak diselesaikan.
- `finalizedXpRef` mencegah finalisasi ganda untuk satu run kuis. Implementasi saat ini belum memiliki ledger anti-replay yang mencegah pengguna mendapat XP lagi dengan mengulang sesi yang sudah selesai; anti-farming di sini tidak berarti replay diblokir.
- Akurasi minimal 80% menandai sesi lulus. XP sesi yang selesai dan status lulus merupakan hal berbeda: sesi yang selesai tetapi tidak mencapai akurasi tersebut masih dapat mengomit XP.
- Pengguna login menyimpan progress per material ke Supabase `user_progress`; cache progress/XP juga menggunakan `localStorage`. Materi yang dimainkan tanpa login tidak memiliki sinkronisasi progress akun.
- Total XP menggabungkan XP seluruh materi. Level CEFR dihitung dari sesi lulus materi berlevel di collection `materi`; Career yang terpisah tidak ikut perhitungan ini.
- Catatan belajar disimpan per pengguna dan material.

### Bookmark Kosakata

- Dari Review Kata Sulit pada ringkasan kuis, pengguna dapat menambahkan kata ke bookmark.
- Bookmark berisi `german`, `indonesian`, dan `context`, disimpan di browser pada key `sideutsch-bookmarks`.
- Duplikat kata Jerman dicegah; bookmark dapat dilihat dan dihapus pada `/dashboard/bookmark`.
- Bookmark bersifat client-side per browser dan tidak disimpan atau disinkronkan ke Supabase.

### Dashboard, Level, dan Tooltip

Dashboard menampilkan total XP, level CEFR, progress menuju level berikutnya, dan pencapaian materi. Tooltip/keterangan pada kartu Progress Belajar menerangkan bahwa XP berasal dari semua materi, sementara level CEFR dihitung dari sesi lulus Alltagsdeutsch berlevel.

Bobot poin per sesi lulus menurut level materi:

| Level materi | Poin per sesi lulus |
| --- | ---: |
| A1 | 10 |
| A2 | 20 |
| B1 | 30 |
| B2 | 40 |
| C1 | 50 |
| C2 | 60 |

Threshold total poin untuk label level dashboard:

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

### Fitur Pendukung

- `/pengucapan` dan `/grammar` menyediakan panduan bahasa.
- Web Speech API browser (`de-DE`) membacakan kosakata dan konteks bila tersedia.
- Profil pengguna menyediakan pengaturan nama, foto, dan penggantian password.
- Admin mengelola akun melalui `/admin` dan Admin API yang terproteksi.

## Tech Stack

| Area | Teknologi |
| --- | --- |
| Framework / rendering | Astro 7, SSR (`output: "server"`) |
| Hosting | Vercel melalui `@astrojs/vercel` |
| Komponen interaktif | Preact 11, `@astrojs/preact` |
| Styling | CSS murni dan CSS variables; tanpa Tailwind |
| Auth, database, storage | Supabase Auth, PostgreSQL, Supabase Storage, `@supabase/ssr`, `@supabase/supabase-js` |
| Konten | Astro Content Collections, Markdown, Zod |
| Navigasi | Astro `ClientRouter` |
| Ucapan | Web Speech API |
| Penyimpanan browser | `localStorage` untuk cache progress/XP dan bookmark |
| Runtime | Node.js `>=22.23.4` |

## Model Data Tingkat Tinggi

- Supabase Auth mengelola akun dan sesi.
- `profiles` menyimpan NIM opsional, nama, nomor WhatsApp, dan URL avatar.
- `user_progress` menyimpan XP, sesi lulus, dan catatan per kombinasi pengguna dan slug materi; akses dibatasi oleh RLS.
- Konten materi tersimpan sebagai Markdown di Astro Content Collections, bukan tabel Supabase.
- Bookmark tersimpan di `localStorage`, bukan entitas database.

Skema dan batasan relasi dirinci dalam [ERD.md](./ERD.md).

## Operasional

- Variabel lingkungan: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`. Jangan commit nilai rahasia.
- Terapkan SQL Supabase, RLS, migrasi nullable `profiles.nim`, dan bucket Storage `avatars` sesuai deployment.
- Jalankan `npm run build` sebelum perubahan siap dipush.
- Belum ada script test otomatis khusus dalam `package.json`; build dan uji manual tetap diperlukan.
