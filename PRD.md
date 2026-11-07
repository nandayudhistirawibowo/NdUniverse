# siDeutsch — Product Requirements Document

**Status:** Dokumentasi implementasi V2.0
**Produk:** Platform belajar bahasa Jerman universal A1–C2

## Ringkasan Produk

siDeutsch adalah platform pembelajaran bahasa Jerman dengan materi sehari-hari, materi bidang profesional, latihan 4 pilar CEFR, kuis, ujian simulasi, progress pengguna, dan audio pengucapan. Produk mendukung mode tamu serta akun login yang menyinkronkan progress ke Supabase.

Koleksi saat ini berisi **425+ file materi** dan sekitar **8.500 kosakata**, mencakup Alltagsdeutsch A1–C2, Fachdeutsch, dan materi Career yang masih bertahap hadir sebagai Coming Soon.

## Tujuan dan Pengguna

- Membantu pengguna belajar bahasa Jerman dari level A1 hingga C2.
- Membagi pembelajaran materi menjadi empat keterampilan CEFR: Reading/Lesen, Listening/Hören, Writing/Schreiben, dan Speaking/Sprechen.
- Menyediakan latihan berbasis sesi, umpan balik pengucapan dan audio, progress XP, serta materi profesi.
- Menjaga fitur guest tetap dapat digunakan tanpa login; sinkronisasi progress berlaku bagi pengguna login.

## Fitur Utama

### Materi dan Struktur Sesi

- Alltagsdeutsch: materi bahasa Jerman sehari-hari untuk A1–C2.
- Fachdeutsch: materi kosakata untuk bidang akademik dan profesional.
- Career: katalog persiapan dunia kerja dengan status Coming Soon.
- Setiap materi memiliki kosakata Jerman, terjemahan Indonesia, konteks Jerman, dan terjemahan konteks.
- Kosakata dibagi menjadi **4 sesi**, dengan **maksimal 5 kosakata per sesi** sehingga satu sesi mencakup kosakata 1–5, 6–10, 11–15, atau 16–20.
- Detail materi menampilkan tabel kosakata per sesi beserta tombol speaker dan tombol latihan keempat pilar.
- Route guest menggunakan `/materi/[slug]` dan `/materi/[slug]/latihan`; route login menggunakan `/dashboard/materi/[slug]` dan `/dashboard/materi/[slug]/latihan`.

### Kuis 4 Pilar CEFR

Pilihan pilar dikirim sebagai query `type` dan batch kosakata dikirim sebagai query `session`.

- **Reading / Lesen:** menampilkan teks atau konteks, kemudian meminta jawaban pilihan ganda atau fallback Word Matcher bila data Reading tidak tersedia.
- **Listening / Hören:** memutar audio kata atau konteks, kemudian menggunakan pilihan ganda. Fallback memakai Word Matcher.
- **Writing / Schreiben:** menampilkan instruksi atau kata Indonesia dan meminta jawaban bahasa Jerman melalui text box. Validasi memakai fuzzy matching tanpa hint artikel.
- **Speaking / Sprechen:** menampilkan pertanyaan Jerman, menyediakan text box, dan mic-to-text menggunakan Web Speech API.
- Pada setiap pilar, maksimal lima kosakata dari sesi aktif diproses sebagai lima soal.
- Tipe soal lama bukan lagi generator acak global; tipe soal disesuaikan dengan pilar aktif.

### Sistem Nyawa, XP, dan Anti-Farming

- Kuis dimulai dengan tiga nyawa.
- Jawaban salah mengurangi nyawa dan menambahkan kata terkait ke Review Kata Sulit.
- Jawaban benar menambah 10 XP ke state sesi sementara.
- XP baru tidak dikomit secara final sebelum sesi mencapai penyelesaian.
- Jika Game Over, XP sementara dibuang dan tidak disimpan.
- `finalizedXpRef` mencegah finalisasi ganda untuk run kuis yang sama.
- Sistem anti-farming saat ini secara khusus membatalkan XP dari sesi yang berakhir Game Over dan menjaga XP tidak difinalisasi dua kali dalam satu run.

### Progress dan Pilar Lulus

- Progress disimpan dalam `user_progress.sessions_passed` sebagai JSONB.
- Format baru menggunakan string `reading`, `listening`, `writing`, dan `speaking`.
- Materi baru dianggap selesai hanya jika keempat pilar terdapat pada progress.
- Data lama berupa `[1, 2, 3, 4]` dinormalisasi ke empat nama pilar saat dibaca.
- Peserta menerima XP kuis per jawaban benar, tetapi kartu materi menampilkan kemajuan 0/4 hingga 4/4 pilar.

### Level CEFR

Bobot poin materi Alltagsdeutsch yang lulus keempat pilarnya:

| Level | Poin |
| --- | ---: |
| A1 | 10 |
| A2 | 20 |
| B1 | 30 |
| B2 | 40 |
| C1 | 50 |
| C2 | 60 |

Total level dihitung berdasarkan materi yang sudah lulus seluruh pilar. Materi Fachdeutsch dan Career tidak menambah poin Level CEFR.

### Mock Exam 22 Soal

Route `/ujian/[level]` menyediakan Mock Exam mini:

- 10 Lesen
- 10 Hören
- 1 Schreiben
- 1 Sprechen
- Kelulusan keseluruhan jika skor minimal 60%.
- Status kelulusan disimpan browser pada `localStorage` dengan key `sideutsch-ujian-[level]`.
- Tombol melihat sertifikat ditampilkan apabila lulus.

### Simulasi Goethe-Zertifikat

Route `/ujian/goethe/[level]` menyediakan simulasi resmi yang dibagi menjadi empat modul terpisah:

- Lesen: teks panjang, pilihan ganda, dan timer modul.
- Hören: audio TTS, pilihan ganda, dan pembatasan audio maksimal satu kali per soal.
- Schreiben: instruksi spesifik dan text box besar.
- Sprechen: topic lisan dan Mic to Text.

Timer standar:

| Level | Lesen | Hören | Schreiben | Sprechen |
| --- | ---: | ---: | ---: | ---: |
| A1 | 25 menit | 20 menit | 20 menit | 15 menit |
| A2 | 30 menit | 30 menit | 30 menit | 15 menit |
| B1 | 65 menit | 40 menit | 60 menit | 15 menit |

Level B2 ke atas mengikuti durasi yang dikonfigurasi pada implementasi halaman dan setiap modul tetap menggunakan countdown serta penyelesaian otomatis saat waktu habis.

Kelulusan seluruh simulasi mensyaratkan **skor minimal 60% pada setiap modul**, bukan hanya rata-rata. Hasil menampilkan skor, rating, paragraf kunci untuk Lesen, transkrip untuk Hören, serta kata kunci dan umpan balik untuk Writing/Speaking.

Status `sideutsch-goethe-[level]` disimpan di `localStorage`. Sertifikat lulus dapat dibuka dan diunduh sebagai PDF melalui `html2pdf.js`.

### Audio TTS dan Microphone

- Sistem TTS mencari teks pada `public/audio/tts/manifest.json`.
- Terdapat **8.372 file MP3 statis** hasil Edge TTS.
- Jika manifest atau MP3 gagal, aplikasi memakai Web Speech API dengan bahasa `de-DE`.
- Speaking memakai browser Speech Recognition untuk mengubah rekaman suara menjadi teks sebelum fuzzy matching.

### Autentikasi dan Profil

- Login mendukung email atau NIM lama yang dipetakan ke akun Supabase.
- Akun baru dapat dibuat melalui auto-signup bila kredensial belum ada.
- `profiles.nim` bersifat nullable.
- Avatar disimpan sebagai objek Private di bucket Supabase Storage `avatars`.
- Avatar menggunakan Signed URL dengan masa berlaku satu jam dan tidak dapat diakses publik secara langsung.

### Bookmark dan Penyimpanan Client

- Bookmark kosakata disimpan di `localStorage` dengan key `sideutsch-bookmarks`.
- Duplikat kata Jerman dicegah.
- Status Mock Exam, hasil Simulasi Goethe, dan data sertifikat disimpan client-side.
- Sertifikat PDF bukan entitas database.

### Dashboard, Bantuan, dan Admin

- Dashboard menampilkan XP, kemajuan level CEFR, progress materi, dan pencapaian pilar.
- Materi Fachdeutsch dan Career tidak menambah poin Level CEFR.
- Halaman Bantuan, profil, bookmark, dan dashboard dilindungi middleware sesuai akses.
- Admin mengelola akun melalui portal admin terproteksi.

## Tech Stack

| Area | Teknologi |
| --- | --- |
| Framework / rendering | Astro 7, SSR |
| Komponen interaktif | Preact 11, `@astrojs/preact` |
| Database dan auth | Supabase PostgreSQL/Auth/Storage |
| Content | Astro Content Collections, Markdown, Zod |
| Styling | CSS murni dan CSS variables |
| Audio | 8.372 MP3 Edge TTS, Web Speech API, Speech Recognition API |
| PDF | html2pdf.js |
| Hosting | Vercel |
| Penyimpanan browser | localStorage |

## Model Data

- Konten materi tersimpan sebagai file Markdown di `src/content/materi/` dan collection Career.
- `profiles` menyimpan identitas dan avatar pengguna.
- `user_progress` menyimpan XP, JSONB `sessions_passed`, dan catatan per pengguna serta slug materi.
- Bookmark, status ujian, dan sertifikat tidak disimpan sebagai tabel Supabase.

Skema relasi detail tersedia di [ERD.md](./ERD.md) dan alur aplikasi tersedia di [FLOWCHART.md](./FLOWCHART.md).
