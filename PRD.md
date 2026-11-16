# PRD Modul Jerman (NdUniverse)

**Status:** Requirements dan ringkasan fitur source saat ini; bukan konfirmasi status deployment
**Produk:** Platform belajar bahasa Jerman universal A1–C2

## Status Bahasa UI

UI Indonesian-first menggunakan string hardcoded tanpa sistem i18n terpusat. Tautan `/en` dan `/de` memilih modul pembelajaran, bukan pengubah bahasa global. Beberapa komponen dapat memiliki varian bahasa hardcoded; materi dan soal tetap memakai bahasa target. Dashboard German berada di `/dashboard-de`, sedangkan dashboard English berada di `/en/dashboard`.

### Known Issues / Backlog UI

- Audit copy pemasaran yang masih berbahasa Inggris di `src/pages/index.astro` (kicker, penanda section, dan tagline footer) jika targetnya adalah UI yang sepenuhnya berbahasa Indonesia. String saat ini hardcoded dan tidak dikelola melalui i18n.

## Ringkasan Produk

Modul Jerman NdUniverse adalah platform pembelajaran bahasa Jerman dengan materi sehari-hari, materi bidang profesional, latihan 4 pilar CEFR, kuis, ujian simulasi, progress pengguna, dan audio pengucapan. Seluruh fitur pembelajaran memerlukan login dan progress disinkronkan ke Supabase.

**Catatan:** Modul English menyediakan Everyday dan Academic English, persiapan IELTS/TOEFL, serta latihan empat pilar. Aset audio yang dikonfigurasi sebagai CDN diambil dari jsDelivr.

Jumlah file materi dan kosakata berubah seiring penambahan konten; dokumen ini tidak menetapkan angka inventaris tetap. Konten mencakup Alltagsdeutsch A1–C2, Fachdeutsch, Career, serta koleksi English.

## Tujuan dan Pengguna

- Membantu pengguna belajar bahasa Jerman dari level A1 hingga C2.
- Membagi pembelajaran materi menjadi empat keterampilan CEFR: Reading/Lesen, Listening/Hören, Writing/Schreiben, dan Speaking/Sprechen.
- Menyediakan latihan berbasis sesi, umpan balik pengucapan dan audio, progress XP, serta materi profesi.
- Mewajibkan login untuk mengakses fitur pembelajaran dan menyinkronkan progress pengguna ke Supabase.

## Fitur Utama

### Materi dan Struktur Sesi

- Alltagsdeutsch: materi bahasa Jerman sehari-hari untuk A1–C2.
- Fachdeutsch: materi kosakata untuk bidang akademik dan profesional.
- Career: katalog persiapan dunia kerja dengan empat rumpun profesi.
- Setiap materi memiliki kosakata Jerman, terjemahan Indonesia, konteks Jerman, dan terjemahan konteks.
- Kosakata dibagi menjadi **4 sesi**, dengan **maksimal 5 kosakata per sesi** sehingga satu sesi mencakup kosakata 1–5, 6–10, 11–15, atau 16–20.
- Detail materi menampilkan tabel kosakata per sesi beserta tombol speaker dan tombol latihan keempat pilar.
- Halaman materi dan latihan tersedia pada route modul German dan English; fitur belajar yang memerlukan akun menggunakan autentikasi Supabase.

### Kuis 4 Pilar CEFR

Pilihan pilar dikirim sebagai query `type` dan batch kosakata dikirim sebagai query `session`.

- **Reading / Lesen:** menampilkan teks atau konteks, kemudian meminta jawaban pilihan ganda atau fallback Word Matcher bila data Reading tidak tersedia.
- **Listening / Hören:** memutar audio kata atau konteks, kemudian menggunakan pilihan ganda. Fallback memakai Word Matcher.
- **Writing / Schreiben:** menampilkan instruksi atau kata Indonesia dan meminta jawaban bahasa Jerman melalui text box. Validasi memakai fuzzy matching tanpa hint artikel.
- **Speaking / Sprechen:** menampilkan pertanyaan Jerman, menyediakan text box, dan mic-to-text menggunakan Web Speech API.
- Pada setiap pilar, maksimal lima kosakata dari sesi aktif diproses sebagai lima soal.
- Tipe soal lama bukan lagi generator acak global; tipe soal disesuaikan dengan pilar aktif.
- Pengguna bebas memilih sesi yang tersedia dan pilar apa pun tanpa menyelesaikan sesi/pilar sebelumnya. URL latihan membawa `session` dan `type`; keduanya tidak dikunci berdasarkan progres sebelumnya.
- Setelah kuis selesai, pengguna kembali ke halaman materi; aplikasi tidak mengarahkan ke pilar berikutnya secara paksa.
- Status penyelesaian tetap dicatat per pasangan sesi-pilar, misalnya `s1-reading` atau `s2-writing`, untuk menampilkan indikator progres. Status ini bukan aturan akses.

### Sistem Nyawa, XP, dan Anti-Farming

- Kuis dimulai dengan tiga nyawa.
- Jawaban salah mengurangi nyawa dan menambahkan kata terkait ke Review Kata Sulit.
- Jawaban benar menambah 10 XP ke state sesi sementara.
- XP baru tidak dikomit secara final sebelum sesi mencapai penyelesaian.
- Jika Game Over, XP sementara dibuang dan tidak disimpan.
- `finalizedXpRef` mencegah finalisasi ganda untuk run kuis yang sama.
- Sistem anti-farming membatalkan XP sementara dari sesi yang berakhir Game Over dan mencegah finalisasi XP ganda pada run yang sama. Ini bukan deteksi farming lintas akun/perangkat.

### NdBot v2 — Chatbot Tutor berbasis RAG

- Chatbot menjawab pertanyaan belajar menggunakan potongan materi Markdown yang diindeks pada tabel Supabase `public.documents`.
- Pertanyaan terakhir dapat ditulis ulang oleh Groq untuk memperbaiki typo, memperluas singkatan, dan menyesuaikan bahasa pencarian; jika rewrite gagal, pertanyaan asli tetap digunakan.
- Cloudflare Workers AI menghasilkan embedding `@cf/baai/bge-small-en-v1.5` berdimensi 384. Supabase `pgvector` mencari hingga tiga potongan materi dengan ambang kemiripan 0.35.
- Potongan materi yang relevan diberikan ke model Groq untuk menyusun jawaban tutor. Ingest mengambil Markdown German dan English dari direktori konten modul serta subset dokumentasi proyek yang dikonfigurasi di `scripts/ingest-rag.py`.
- Pembaruan materi tidak otomatis memperbarui indeks. Jalankan proses ingest penuh sesuai panduan di `HANDOVER.md`; script menghapus seluruh baris `documents` sebelum memasukkan kembali indeks.

### Career dan Boss Fight

Katalog `/de/career` menyediakan empat profesi:

1. IT & Software Engineering melalui `/de/career/it`
2. Digital Business & E-Commerce melalui `/de/career/business`
3. Pflege & Gesundheitswesen melalui `/de/career/health`
4. Gizi & Kebidanan melalui `/de/career/nutrition`

Setiap profesi memiliki **50 kosakata** pada Astro Content Collections Markdown di `src/modules/german/content/career/`. Halaman materi menampilkan Latihan Kosakata lima kata dasar per batch, kuis pilihan ganda sederhana, dan card Boss Fight.

Boss Fight dipisahkan ke route `/de/career/[profesi]/boss` dan memakai overlay cinematic yang memenuhi viewport. Pengalaman dimulai dengan adegan ruangan kantor: pintu terbuka dengan animasi, Boss HRD masuk, dan dialog pengantar dibacakan melalui audio TTS. Typewriter menampilkan teks dengan kecepatan yang diselaraskan ke durasi audio, dengan fallback jika audio tidak tersedia. User kemudian menjawab **10 pertanyaan wawancara bertahap** melalui text box atau Speech Recognition/microphone. Jawaban dinilai secara fuzzy sederhana terhadap keywords yang berasal dari frontmatter Markdown `boss_questions`. Pertanyaan berikutnya baru muncul setelah jawaban dikirim.

Setelah sepuluh pertanyaan selesai, aplikasi menampilkan layar hasil khusus **Wawancara Selesai!** beserta status kelulusan, badge profesi, dan tombol kembali ke materi profesi. Konten Career disimpan di `src/modules/german/content/career/*.md`, bukan database Supabase.

### Progress dan Pilar Lulus

- Progress disimpan dalam `user_progress.sessions_passed` sebagai JSONB.
- Format baru menyimpan identitas sesi dan pilar, misalnya `["s1-reading", "s2-writing"]`.
- Menyelesaikan satu pasangan sesi-pilar menambahkan kuncinya tanpa menghapus progres lain; format tersebut dipakai untuk mencocokkan centang penyelesaian yang tepat.
- Format lama berupa nama pilar (`reading`, `listening`, `writing`, `speaking`) atau angka sesi `[1, 2, 3, 4]` masih dinormalisasi saat dibaca untuk kompatibilitas data sebelumnya.
- Pemilihan sesi/pilar tidak bergantung pada array progres tersebut.
- Materi baru dianggap selesai hanya jika keempat pilar tercatat sebagai selesai sesuai aturan progress dashboard.
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

Route `/de/ujian/[level]` menyediakan Mock Exam mini:

- 10 Lesen
- 10 Hören
- 1 Schreiben
- 1 Sprechen
- Kelulusan keseluruhan jika skor minimal 60%.
- Status kelulusan disimpan browser pada `localStorage` dengan key `nduniverse-ujian-[level]`.
- Tombol melihat sertifikat ditampilkan apabila lulus.

Komposisi Mini-Mock tetap 22 soal: 10 Lesen, 10 Hören, 1 Schreiben, dan 1 Sprechen. Schreiben dan Sprechen dinilai persentase berdasarkan kecocokan kata kunci sehingga jawaban parsial tidak langsung bernilai 0 atau 25. Skor total akhir ditampilkan dalam skala 0–100 persen.

### Simulasi Goethe-Zertifikat

Route `/de/ujian/goethe/[level]` menyediakan simulasi resmi yang dibagi menjadi empat modul terpisah:

- Lesen: teks panjang, pilihan ganda, dan timer modul.
- Hören: audio TTS, pilihan ganda, dan pembatasan audio maksimal satu kali per soal.
- Schreiben: instruksi spesifik dan text box besar.
- Sprechen: topic lisan dan Mic to Text.

Skor Lesen maksimal menggunakan jumlah jawaban pilihan ganda yang benar; Hören mengikuti jumlah jawaban benar. Schreiben dan Sprechen dinilai parsial dengan kata kunci: artikel Jerman di-normalisasi, keyword di-tokenisasi, dan persentase token/keyword yang cocok menentukan poin modul. Jadi satu jawaban esai tidak pernah bernilai penuh atau 0 hanya karena satu kalimat tidak sama persis dengan kunci jawaban.

Timer standar:

| Level | Lesen | Hören | Schreiben | Sprechen |
| --- | ---: | ---: | ---: | ---: |
| A1 | 25 menit | 20 menit | 20 menit | 15 menit |
| A2 | 30 menit | 30 menit | 30 menit | 15 menit |
| B1 | 65 menit | 40 menit | 60 menit | 15 menit |

Level B2 ke atas mengikuti durasi yang dikonfigurasi pada implementasi halaman dan setiap modul tetap menggunakan countdown serta penyelesaian otomatis saat waktu habis.

Kelulusan seluruh simulasi mensyaratkan **skor minimal 60% pada setiap modul**, bukan hanya rata-rata. Hasil menampilkan skor, rating, paragraf kunci untuk Lesen, transkrip untuk Hören, serta kata kunci dan umpan balik untuk Writing/Speaking.

Status `nduniverse-goethe-[level]` disimpan di `localStorage`. Sertifikat lulus dapat dibuka dan diunduh sebagai PDF melalui `html2pdf.js`.

### Anti-Cheat Fullscreen (NdBot)

- Ujian besar mengaktifkan mode fullscreen melalui browser dan memantau perubahan fullscreen, tab yang disembunyikan, serta window yang kehilangan fokus.
- Setiap pelanggaran menambah strike dengan cooldown lima detik. Strike ketiga memaksa pengumpulan/pengiriman ujian.
- NdBot tetap tersedia dalam mode ujian untuk menampilkan tingkat strike; chat tutor dinonaktifkan dalam mode tersebut. Mode kuis juga mengunci chat. Kunci chat ini tidak membatasi pemilihan materi, sesi, atau pilar berdasarkan progres; pengguna tetap dapat memilih sesi/pilar yang tersedia.
- Jika browser menolak permintaan fullscreen, aplikasi mencatat peringatan; dukungan fullscreen tetap bergantung pada kebijakan browser.

### Audio TTS dan Microphone

- Audio English mendukung aksen US (`en-US`) dan UK (`en-GB`), dengan URL berbasis hash dan resolver di `src/core/audio/cdn-audio.js`; TTS German juga menggunakan URL berbasis hash, sedangkan audio statis dapat di-resolve dari manifest CDN.
- Boss Fight menggunakan voice acting audio TTS untuk dialog HRD; generatornya tersedia melalui `npm run generate:tts:boss`.
- Aset dibuat dengan Edge TTS dan disajikan melalui jsDelivr. Fallback Web Speech menggunakan locale sesuai aksen/bahasa audio.
- Speaking memakai browser Speech Recognition untuk mengubah rekaman suara menjadi teks sebelum fuzzy matching.

### Landing dan SVG Flags

- Landing memakai title `Belajar Bahasa Jerman & Inggris Gratis | NdUniverse` dan description yang memuat keyword belajar bahasa, ujian, TTS, CEFR, dan tutor AI.
- Pilihan modul English dan German menggunakan aset `public/flags/gb.svg` dan `public/flags/de.svg`, bukan emoji, supaya tampil konsisten lintas perangkat tanpa mengubah tujuan tautan login.

### Autentikasi dan Profil

- Login mendukung email atau NIM lama yang dipetakan ke akun Supabase.
- Akun baru dapat dibuat melalui auto-signup bila kredensial belum ada.
- `profiles.nim` bersifat nullable.
- Avatar disimpan sebagai objek Private di bucket Supabase Storage `avatars`.
- Avatar menggunakan Signed URL dengan masa berlaku satu jam dan tidak dapat diakses publik secara langsung.

### Bookmark dan Penyimpanan Client

- Bookmark kosakata disimpan di `localStorage` dengan key `nduniverse-bookmarks`.
- Duplikat kata Jerman dicegah.
- Status Mock Exam, hasil Simulasi Goethe, dan data sertifikat disimpan client-side.
- Sertifikat PDF bukan entitas database.

### Dashboard, Bantuan, dan Admin

- Dashboard menampilkan XP, kemajuan level CEFR, progress materi, dan pencapaian pilar.
- Materi Fachdeutsch dan Career tidak menambah poin Level CEFR.
- Halaman Bantuan, profil, bookmark, dan dashboard dilindungi middleware sesuai akses.
- Admin mengelola akun melalui portal admin terproteksi.

### SEO dan Crawler

- Landing menetapkan title dan description yang SEO-friendly, `index, follow`, canonical URL, Open Graph, dan Twitter Cards.
- `src/core/ui/Layout.astro` menerima title, description, image, serta canonical URL per halaman dan menghasilkan Open Graph/Twitter metadata dari nilai tersebut. Layout khusus dashboard mengatur kebijakan indexing untuk rute privat.
- `src/pages/sitemap-content.xml.ts` menghasilkan URL publik `/`, `/de`, `/en`, `/login-de`, `/login-en`, serta materi; rute dashboard/admin tidak dimasukkan.
- `public/robots.txt` mengizinkan `/` dan melarang `/dashboard/`, `/dashboard-de`, `/en/dashboard/`, `/admin/`, serta `/api/`.

## Tech Stack

| Area | Teknologi |
| --- | --- |
| Framework / rendering | Astro 7, SSR |
| Komponen interaktif | Preact 11, `@astrojs/preact` |
| Database dan auth | Supabase PostgreSQL/Auth/Storage |
| Retrieval chatbot | Supabase `pgvector`, tabel `documents`, dan RPC `match_documents` |
| AI chatbot | Cloudflare Workers AI untuk embedding; Groq untuk query rewriting dan jawaban |
| CDN audio | jsDelivr untuk aset dan manifest audio yang dikonfigurasi ke CDN |
| Content | Astro Content Collections, Markdown, Zod |
| Styling | CSS murni dan CSS variables |
| Audio | Edge TTS, aset audio melalui CDN, Web Speech API, Speech Recognition API |
| PDF | html2pdf.js |
| Hosting | Vercel |
| Penyimpanan browser | localStorage |

UI Indonesian-first dan hardcoded tanpa sistem i18n; pengecualian copy Inggris yang diketahui dicatat sebagai backlog di atas.

## Model Data

- Konten materi tersimpan sebagai file Markdown di `src/modules/german/content/materi/` dan collection Career.
- `profiles` menyimpan identitas dan avatar pengguna.
- `user_progress` menyimpan XP, JSONB `sessions_passed`, dan catatan per pengguna serta slug materi.
- Bookmark, status ujian, dan sertifikat tidak disimpan sebagai tabel Supabase.

Skema relasi detail tersedia di [ERD.md](./ERD.md) dan alur aplikasi tersedia di [FLOWCHART.md](./FLOWCHART.md).
