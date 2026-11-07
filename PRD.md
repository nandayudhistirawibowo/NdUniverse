# siDeutsch — Product Requirements Document

**Status:** Dokumentasi kondisi implementasi saat ini  
**Produk:** Platform belajar bahasa Jerman untuk pengguna umum

## Latar Belakang

siDeutsch adalah platform belajar bahasa Jerman interaktif untuk **Pengguna Umum**, dari komunikasi sehari-hari hingga kosakata bidang profesional. Produk menyediakan materi bertingkat A1–C2, kuis, progress, bookmark kosakata, pengucapan, grammar, dan materi persiapan kerja.

Koleksi saat ini mencakup **424 file materi Alltagsdeutsch dan Fachdeutsch** (411 Alltagsdeutsch A1–C2 dan 13 Fachdeutsch), serta 1 file Career. Jumlah kosakata sekitar **8.500 entri**: 8.220 Alltagsdeutsch, 260 Fachdeutsch, dan 20 Career.

## Tujuan dan Pengguna

- Membantu **Pengguna Umum**, termasuk pelajar, belajar bahasa Jerman dari A1 hingga C2.
- Menyediakan Alltagsdeutsch, Fachdeutsch, serta halaman Career yang saat ini berstatus Coming Soon.
- Memberikan sesi kuis, XP, bookmark kosakata, dan sinkronisasi progress bagi pengguna yang masuk.
- Menyediakan halaman Bantuan, profil, dashboard, dan area admin.

Admin mengelola akun dan platform melalui portal terpisah.

## Fitur Utama

### Autentikasi dan Akses

- Halaman `/login` menerima email atau NIM. NIM dipetakan ke alamat Supabase `NIM@student.sideutsch.com`; alamat email digunakan langsung.
- Pengguna baru tidak memerlukan tombol daftar. Jika login gagal dengan `Invalid login credentials`, aplikasi mencoba membuat akun otomatis (*auto-signup*), lalu mencoba masuk kembali.
- Profil pengguna umum dapat memiliki kolom `nim` kosong (`NULL`). Akun NIM lama tetap dapat digunakan.
- Jika akun sudah terdaftar tetapi password salah, pengguna menerima pesan yang menjelaskan kondisi tersebut. Konfirmasi email Supabase yang aktif dapat menghalangi login otomatis hingga email dikonfirmasi.
- Admin menggunakan `/admin/login` dengan validasi dan otorisasi khusus.
- Middleware melindungi `/dashboard`, `/career`, dan `/bantuan`; rute admin memerlukan hak admin. Materi publik dapat dilihat tanpa login.

### Materi dan Jalur Belajar

- **Alltagsdeutsch:** materi bahasa umum berdasarkan level CEFR A1–C2.
- **Fachdeutsch:** kosakata dan konteks berbagai bidang studi/profesional.
- **Career:** track persiapan kerja tanpa level CEFR. Halaman katalog `/career` menampilkan pemberitahuan Coming Soon; kuis Career belum tersedia.
- Materi Alltagsdeutsch dan Fachdeutsch berada di content collection `materi`; Career berada di collection `career`.
- Materi memuat judul, deskripsi, dan kosakata. Setiap entri kosakata menyediakan kata Jerman, arti Indonesia, kalimat konteks Jerman, dan terjemahan konteks.
- Kosakata materi utama dibagi ke sesi latihan maksimal lima kata.

### Kuis, XP, dan Progress

- Kuis materi utama menggunakan variasi Tap & Arrange (Susun Kata), Word Matcher, dan Text Box.
- Setiap kuis dimulai dengan tiga nyawa. Jawaban salah mengurangi nyawa dan menambahkan kata terkait ke Review Kata Sulit.
- **Anti-Farming XP:** jawaban benar menambah 10 XP ke state sesi sementara. XP baru ditambahkan ke total setelah sesi selesai; jika nyawa habis (*Game Over*), XP sementara hangus dan tidak disimpan.
- `finalizedXpRef` mencegah finalisasi ganda untuk satu run kuis. Implementasi belum memiliki ledger anti-replay yang mencegah pengguna mendapat XP lagi dengan mengulang sesi yang sudah selesai; mekanisme anti-farming ini khusus membatalkan XP sesi yang berakhir Game Over.
- Akurasi minimal 80% menandai sesi lulus. Sesi yang selesai tetapi tidak mencapai akurasi tersebut tetap dapat mengomit XP.
- Pengguna yang login menyimpan progress per materi ke Supabase `user_progress`; cache progress/XP juga menggunakan `localStorage`. Materi yang dimainkan tanpa login tidak tersinkron ke akun.
- Total XP menggabungkan XP seluruh materi. Level CEFR dihitung dari sesi lulus materi berlevel di collection `materi`; Career tidak ikut perhitungan ini.
- Catatan belajar disimpan per pengguna dan material.

### Text-to-Speech (TTS)

- TTS menggunakan **8.372 file MP3 statis** hasil generate Edge TTS, disimpan di `public/audio/tts/`. `manifest.json` memetakan teks ke file audio.
- Saat pengguna menekan tombol speaker, aplikasi mencari teks di manifest dan memutar file MP3 jika tersedia.
- Jika file tidak ditemukan atau audio gagal diputar, aplikasi menggunakan Web Speech API browser (`de-DE`) sebagai fallback.

### Avatar Profil

- Foto profil disimpan di bucket Supabase Storage `avatars` yang bersifat **Private**.
- Kolom `profiles.avatar_url` menyimpan path objek Storage. Aplikasi membuat dan merender *Signed URL* yang berlaku selama **1 jam**.
- Kebijakan Storage membatasi akses file kepada pemilik dan admin yang berwenang.

### Bookmark Kosakata

- Dari Review Kata Sulit pada ringkasan kuis, pengguna dapat menyimpan kata ke bookmark.
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
- **Career** tersedia sebagai halaman Coming Soon; kuis Career belum tersedia.
- **Halaman Bantuan** tersedia di `/bantuan`.
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
| Audio TTS | 8.372 file MP3 statis hasil generate Edge TTS di `public/audio/tts/`; fallback Web Speech API |
| Penyimpanan browser | `localStorage` untuk cache progress/XP dan bookmark |
| Runtime | Node.js `>=22.23.4` |

## Model Data Tingkat Tinggi

- Supabase Auth mengelola akun dan sesi.
- `profiles` menyimpan NIM opsional, nama, nomor WhatsApp, dan path avatar.
- `user_progress` menyimpan XP, sesi lulus, dan catatan per kombinasi pengguna dan slug materi; akses dibatasi oleh RLS.
- Konten materi tersimpan sebagai Markdown di Astro Content Collections, bukan tabel Supabase.
- Bookmark tersimpan di `localStorage`; file TTS statis beserta manifest tersimpan di `public/audio/tts/`.

Skema dan batasan relasi dirinci dalam [ERD.md](./ERD.md).

## Operasional

- Variabel lingkungan: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`. Jangan commit nilai rahasia.
- Terapkan SQL Supabase, RLS, migrasi nullable `profiles.nim`, dan bucket Storage `avatars` sesuai deployment.
- Jalankan `npm run build` sebelum perubahan siap dipush.
- Belum ada script test otomatis khusus dalam `package.json`; build dan uji manual tetap diperlukan.
