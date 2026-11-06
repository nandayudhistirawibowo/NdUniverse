# siDeutsch — Product Requirements Document

**Status:** Dokumentasi kondisi implementasi saat ini  
**Produk:** Platform belajar bahasa Jerman untuk siapa saja

## Ringkasan

siDeutsch menyediakan materi bahasa Jerman sehari-hari dan kosakata berbagai bidang, latihan interaktif, serta progress belajar untuk pengguna umum. Koleksi saat ini mencakup **411 materi Alltagsdeutsch A1–C2 (8.220 vocab)**, **13 materi Fachdeutsch (260 vocab)**, dan **1 materi Career (20 vocab)**: total **425 file materi dan sekitar 8.500 entri vocab**.

## Tujuan dan Pengguna

- Membantu siapa saja belajar bahasa Jerman dari A1 hingga C2.
- Menyediakan Alltagsdeutsch, Fachdeutsch, dan materi Career untuk komunikasi dunia kerja.
- Mendukung sesi belajar singkat, kuis, XP, bookmark kosakata, dan sinkronisasi progress bagi pengguna login.
- Memberi guest akses preview materi dan latihan terbatas, serta menyediakan portal admin terproteksi.

Pengguna utama adalah pelajar dan pengguna umum, termasuk guest yang ingin melihat atau mencoba materi, serta admin yang mengelola platform.

## Fitur Utama

### Autentikasi dan Akses

- Pengguna masuk dari `/login` menggunakan email atau NIM; NIM lama tetap dipetakan ke email Supabase berbentuk `NIM@student.sideutsch.com`.
- Jika kredensial tidak cocok karena akun belum tersedia, form mencoba membuat akun otomatis dengan email dan password yang dimasukkan, lalu masuk kembali setelah akun dibuat.
- Akun yang sudah terdaftar tidak dibuat ulang; jika password salah, pengguna mendapat pesan agar memeriksa password.
- Admin menggunakan `/admin/login` dengan alur autentikasi khusus admin.
- Middleware memeriksa autentikasi untuk `/dashboard` dan `/career`, serta otorisasi admin untuk `/admin`.
- Guest dapat mengakses materi publik dan mencoba latihan terbatas.

### Track Materi

- **Alltagsdeutsch:** materi umum berlevel CEFR A1–C2.
- **Fachdeutsch:** kosakata berdasarkan bidang studi.
- **Career:** content collection terpisah untuk persiapan dunia kerja, seperti wawancara, CV, dan komunikasi profesional. `/career` menampilkan katalog; `/career/[slug]` menampilkan vocab dan konteks. Kuis Career belum terimplementasikan.
- Alltagsdeutsch dan Fachdeutsch menggunakan collection `materi`; Career menggunakan collection `career`.
- Materi utama berisi `track`, `judulMateri`, `deskripsi`, dan vocab. Setiap vocab memuat kata Jerman, arti Indonesia, kalimat konteks Jerman, dan terjemahan konteks opsional.
- Latihan materi utama membagi vocab menjadi sesi maksimal lima kata.

### Kuis, XP, dan Progress

- Kuis materi utama menyediakan Tap & Arrange, Word Matcher, dan Text Box; tipe soal bervariasi berdasarkan sesi.
- Pemain memulai dengan tiga nyawa. Jawaban benar menambah 10 XP ke state XP sementara sesi; jawaban salah mengurangi nyawa dan memasukkan kata ke Review Kata Sulit.
- XP sesi baru ditambahkan ke total dan antrean sinkronisasi setelah kuis berakhir dengan seluruh soal selesai. Saat Game Over, XP sesi direset menjadi nol dan tidak dikomit.
- Guard `finalizedXpRef` mencegah satu run kuis dikomit berulang oleh efek Preact. Namun, tidak ada ledger yang mencegah XP didapat lagi dengan mengulang kuis yang telah selesai; jangan menganggap ini sebagai batas anti-replay lintas sesi.
- Akurasi minimal 80% menandai sesi lulus. XP dan status lulus adalah data terpisah: kuis yang selesai tetapi tidak memenuhi akurasi tetap dapat menyimpan XP.
- Pengguna login menyimpan progress per material ke Supabase `user_progress`; nilai total XP juga dicache di `localStorage`. Guest tidak menyimpan progress kuis secara persisten.
- Total XP dashboard menjumlahkan XP dari seluruh progress materi. Level CEFR dihitung dari sesi lulus dan bobot level pada materi berlevel di collection `materi`; Career berada di collection terpisah dan tidak ikut menghitung level.
- Catatan materi tersedia bagi pengguna login dan disimpan pada progress material.

### Bookmark Kosakata

- Kata dari Review Kata Sulit dapat disimpan dari ringkasan kuis.
- Data bookmark berisi `german`, `indonesian`, dan `context`, disimpan di browser pada key `sideutsch-bookmarks`.
- Duplikasi kata Jerman dicegah dengan perbandingan huruf kecil; bookmark dapat dihapus di `/dashboard/bookmark`.
- Bookmark bersifat client-side per browser dan tidak disimpan atau disinkronkan ke Supabase.

### Dashboard, Level, dan Tooltip XP

Dashboard menampilkan total XP, progress level CEFR, pencapaian materi, dan akses ke jalur belajar. Tooltip/teks pada kartu Progress Belajar menerangkan bahwa XP berasal dari semua materi, sedangkan level CEFR hanya dihitung dari materi Alltagsdeutsch berlevel yang sedang digunakan untuk perhitungan level.

Bobot poin per sesi lulus:

| Level materi | Poin |
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

### Fitur Pendukung

- `/pengucapan` dan `/grammar` menyediakan panduan bahasa.
- Web Speech API browser (`de-DE`) membacakan kosakata dan kalimat bila tersedia.
- Profil pengguna menampilkan informasi akun dan avatar; berkas avatar disimpan di Supabase Storage bucket `avatars`.
- Admin mengelola akun lewat `/admin` dan Admin API yang terproteksi.

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

- Supabase Auth mengelola identitas akun.
- `profiles` menyimpan data profil yang digunakan aplikasi: NIM opsional, nama, nomor WhatsApp, dan URL avatar.
- `user_progress` menyimpan XP, sesi lulus, dan catatan per kombinasi user dan slug materi; akses dibatasi oleh RLS.
- Konten materi tetap di Markdown Astro, bukan tabel Supabase.
- Bookmark disimpan di `localStorage`, bukan entitas database.

Skema dan batasan relasi dirinci dalam [ERD.md](./ERD.md).

## Operasional

- Variabel lingkungan: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`. Jangan commit nilai rahasia.
- Terapkan SQL Supabase, RLS, dan bucket Storage `avatars` sesuai deployment.
- Jalankan `npm run build` sebelum perubahan siap dipush.
- Belum ada script test otomatis khusus dalam `package.json`; build dan uji manual tetap diperlukan.
