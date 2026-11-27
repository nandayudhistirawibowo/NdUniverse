# PRD Modul Jerman (NdUniverse)

**Status:** Requirements dan ringkasan fitur source saat ini; bukan konfirmasi status deployment
**Produk:** Platform belajar bahasa Jerman universal A1–C2

## Status Bahasa UI

UI Indonesian-first menggunakan string hardcoded tanpa sistem i18n terpusat. Tautan `/en` dan `/de` memilih modul pembelajaran, bukan pengubah bahasa global. Beberapa komponen dapat memiliki varian bahasa hardcoded; materi dan soal tetap memakai bahasa target. Dashboard German berada di `/dashboard-de`, sedangkan dashboard English berada di `/en/dashboard`.

### Known Issues / Backlog UI

- Audit copy pemasaran yang masih berbahasa Inggris di `src/pages/index.astro` (kicker, penanda section, dan tagline footer) jika targetnya adalah UI yang sepenuhnya berbahasa Indonesia. String saat ini hardcoded dan tidak dikelola melalui i18n.

## Ringkasan Produk

Modul Jerman NdUniverse adalah platform pembelajaran bahasa Jerman dengan materi sehari-hari, materi bidang profesional, latihan 4 pilar CEFR, kuis, ujian simulasi, progress pengguna, dan audio pengucapan. Seluruh fitur pembelajaran memerlukan login dan progress disinkronkan ke Supabase.

**Catatan:** Modul English menyediakan Everyday dan Academic English, persiapan IELTS/TOEFL, serta latihan empat pilar. Aset audio yang dikonfigurasi sebagai CDN diambil dari jsDelivr. Sidebar, header, navigasi, dan tombol dashboard menggunakan Bahasa Indonesia secara hardcoded; `/en` dan `/de` mengganti modul, bukan bahasa UI.

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
- Artikel tata bahasa tidak menjadi entri kosakata tersendiri: daftar materi tidak memuat `the/a/an` atau `der/die/das` sebagai kata target. Artikel tetap dapat muncul dan dinilai pada soal grammar yang memang mengujinya.
- Standar kurikulum materi adalah **4 sesi × 5 kosakata = 20 kosakata**. Setiap kosakata memberi 10 XP pada satu pilar, sehingga batasnya 50 XP per pilar, 200 XP per sesi, dan **800 XP per materi** (4 pilar × 4 sesi). Seluruh Alltagsdeutsch dan Everyday English saat ini memenuhi 20 kata; beberapa materi Academic English masih 17–19 kata dan merupakan pengecualian konten yang belum mencapai 800 XP.
- Detail materi menampilkan tabel kosakata per sesi beserta tombol speaker dan tombol latihan keempat pilar.
- Halaman materi dan latihan tersedia pada route modul German dan English; fitur belajar yang memerlukan akun menggunakan autentikasi Supabase.

### Kuis 4 Pilar CEFR

Pilihan pilar dikirim sebagai query `type` dan batch kosakata dikirim sebagai query `session`.

- **Reading / Lesen:** menampilkan teks atau konteks, kemudian meminta jawaban pilihan ganda atau fallback Word Matcher bila data Reading tidak tersedia.
- **Listening / Hören:** memutar audio kata atau konteks, kemudian menggunakan pilihan ganda. Fallback memakai Word Matcher.
- **Writing / Schreiben:** menampilkan instruksi atau kata Indonesia dan meminta jawaban bahasa target melalui text box. Validasi memakai fuzzy matching; kuis umum mengabaikan artikel, sedangkan soal grammar spesifik tetap mewajibkannya.
- **Speaking / Sprechen:** menampilkan pertanyaan Jerman, menyediakan text box, dan mic-to-text melalui Groq Whisper, Speechmatics sebagai fallback server-side, lalu Web Speech API.
- Grading jawaban teks memakai fuzzy matching untuk variasi typo. `isArticleQuestion` mengenali prompt grammar (misalnya penyebutan article/artikel atau isian rumpang): kuis biasa mengabaikan artikel saat normalisasi, sedangkan jawaban grammar mempertahankan dan mewajibkan artikel.
- Pada setiap pilar, maksimal lima kosakata dari sesi aktif diproses sebagai lima soal.
- Tipe soal lama bukan lagi generator acak global; tipe soal disesuaikan dengan pilar aktif.
- Pengguna bebas memilih sesi yang tersedia dan pilar apa pun tanpa menyelesaikan sesi/pilar sebelumnya. URL latihan membawa `session` dan `type`; keduanya tidak dikunci berdasarkan progres sebelumnya.
- Setelah kuis selesai, pengguna kembali ke halaman materi; aplikasi tidak mengarahkan ke pilar berikutnya secara paksa.
- Status penyelesaian tetap dicatat per pasangan sesi-pilar, misalnya `s1-reading` atau `s2-writing`, untuk menampilkan indikator progres. Status ini bukan aturan akses. Progres pilar di UI bersifat biner: 100% jika tuntas, 0% jika belum. Pasangan pilar yang tuntas digabung (union) saat disimpan agar progres lain tidak tertimpa.
- Semua input jawaban teks mendukung Enter untuk memeriksa/mengirim atau melanjutkan jawaban menggunakan aturan validasi yang sama dengan tombol; pada textarea, Shift+Enter membuat baris baru.
- Dropdown filter level katalog EN/DE bekerja tanpa reload: `Semua Level` menampilkan semua kartu; A1–C2 dicocokkan case-insensitive.

### Sistem Nyawa, XP, dan Anti-Farming

- Kuis dimulai dengan tiga nyawa.
- Jawaban salah mengurangi nyawa dan menambahkan kata terkait ke Review Kata Sulit.
- Jawaban benar menambah XP ke state sesi sementara (10 XP per jawaban benar; maksimal 50 XP per pilar dan 200 XP per sesi; total materi di-cap pada 800 XP).
- XP baru tidak dikomit secara final sebelum sesi/pilar mencapai penyelesaian yang valid.
- Jika Game Over, XP sementara dibuang dan tidak disimpan.
- `finalizedXpRef` mencegah finalisasi ganda untuk run kuis yang sama.
- Anti-farming memblokir XP ketika pengguna mengulang sesi yang keempat pilarnya sudah tuntas. Ini bukan deteksi farming lintas akun/perangkat. XP aplikasi/UI di-cap 800; schema database hanya memeriksa XP non-negatif, sedangkan `supabase/cap_user_progress_xp.sql` adalah cleanup satu kali untuk data lama, bukan CHECK maksimum permanen.

### NdBot v2 — Chatbot Tutor berbasis RAG

- Chatbot menjawab pertanyaan belajar menggunakan potongan materi Markdown yang diindeks pada tabel Supabase `public.documents`.
- Pertanyaan terakhir dapat ditulis ulang oleh Groq untuk memperbaiki typo, memperluas singkatan, dan menyesuaikan bahasa pencarian; jika rewrite gagal, pertanyaan asli tetap digunakan.
- Cloudflare Workers AI menghasilkan embedding `@cf/baai/bge-small-en-v1.5` berdimensi 384. Supabase `pgvector` mencari hingga tiga potongan materi dengan ambang kemiripan 0.35.
- Potongan materi yang relevan diberikan ke model Groq untuk menyusun jawaban tutor. Ingest mengambil Markdown German dan English dari direktori konten modul serta subset dokumentasi proyek yang dikonfigurasi di `scripts/ingest-rag.py`.
- Pembaruan materi tidak otomatis memperbarui indeks. Jalankan proses ingest penuh sesuai panduan di `HANDOVER.md`; script menghapus seluruh baris `documents` sebelum memasukkan kembali indeks.
- Guardrail persona melarang NdBot membahas atau membocorkan kode dan arsitektur internal. Keluhan teknis diarahkan ke WhatsApp Admin; ini aturan percakapan pada prompt, bukan kontrol akses data.

### Career dan Boss Fight

Katalog `/de/career` menyediakan empat profesi:

1. IT & Software Engineering melalui `/de/career/it`
2. Digital Business & E-Commerce melalui `/de/career/business`
3. Pflege & Gesundheitswesen melalui `/de/career/health`
4. Gizi & Kebidanan melalui `/de/career/nutrition`

Setiap profesi memiliki **50 kosakata** pada Astro Content Collections Markdown di `src/modules/german/content/career/`. Halaman materi menampilkan Latihan Kosakata lima kata dasar per batch, kuis pilihan ganda sederhana, dan card Boss Fight.

Boss Fight dipisahkan ke route `/de/career/[profesi]/boss` dan memakai overlay cinematic yang memenuhi viewport. Pengalaman dimulai dengan adegan ruangan kantor: pintu terbuka dengan animasi, Boss HRD masuk, dan dialog pengantar dibacakan melalui audio TTS. Typewriter menampilkan teks dengan kecepatan yang diselaraskan ke durasi audio, dengan fallback jika audio tidak tersedia. User kemudian menjawab **10 pertanyaan wawancara bertahap** melalui text box atau mic-to-text memakai hook STT bersama. Jawaban dinilai terhadap keywords dari frontmatter Markdown `boss_questions`; feedback menampilkan transcript, keyword kena, dan skor, lalu pertanyaan berikutnya otomatis muncul. Alur transkripsi input tidak mengubah pemutaran atau sinkronisasi audio Boss.

Setelah sepuluh pertanyaan selesai, aplikasi menampilkan layar hasil khusus **Wawancara Selesai!** beserta status kelulusan, badge profesi, dan tombol kembali ke materi profesi. Konten Career disimpan di `src/modules/german/content/career/*.md`, bukan database Supabase.

### Progress dan Pilar Lulus

- Progress disimpan dalam `user_progress.sessions_passed` sebagai JSONB.
- Format baru menyimpan identitas sesi dan pilar, misalnya `["s1-reading", "s2-writing"]`.
- Menyelesaikan satu pasangan sesi-pilar menambahkan kuncinya tanpa menghapus progres lain; progres digabung (union) sebelum upsert agar kunci sesi-pilar lain tidak tertimpa. Format tersebut dipakai untuk mencocokkan centang penyelesaian yang tepat.
- Format lama berupa nama pilar (`reading`, `listening`, `writing`, `speaking`) atau angka sesi `[1, 2, 3, 4]` masih dinormalisasi saat dibaca untuk kompatibilitas data sebelumnya.
- Pemilihan sesi/pilar tidak bergantung pada array progres tersebut.
- Materi baru dianggap selesai hanya jika keempat pilar pada semua sesi materi tercatat selesai sesuai aturan progress.
- Tampilan progres pilar bersifat biner: 100% jika pilar tuntas, 0% jika belum.
- Halaman materi (SSR, no-cache) dan dashboard pencapaian English (`/en/dashboard`) serta German (`/dashboard-de`) menampilkan materi yang memiliki XP atau progres pilar. Dashboard/catalog mengambil `user_progress.xp`, mencapnya pada 800, lalu menghitung `Math.round((currentXp / 800) * 100)`; jika XP >= 800, persentase 100% dan bar penuh. Halaman materi memakai status pilar biner 100%/0%. XP maksimum di aplikasi/UI; schema DB tidak memiliki constraint atas 800 dan data lama perlu dibersihkan melalui migration satu kali.

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

### Leaderboard

- Halaman leaderboard terproteksi tersedia untuk modul English (`/en/leaderboard`) dan German (`/de/leaderboard`).
- Top 3 ditampilkan sebagai podium; daftar dilanjutkan hingga maksimal 100 pengguna.
- Supabase RPC `get_leaderboard` menjumlahkan XP dari `user_progress` per pengguna, lalu mengurutkan `profiles.current_level` menurun dan total XP menurun.
- RPC mengecualikan pengguna total XP 0 dan profil dengan nama atau NIM yang mengandung `admin` tanpa membedakan kapitalisasi; hasil dibatasi maksimal 100 dan hanya mengembalikan ID, nama, level, serta XP.
- `Leaderboard.astro` berlangganan Supabase Realtime `postgres_changes` untuk INSERT/UPDATE pada `user_progress` dan `profiles`. SQL memberi grant execute ke `anon`, `authenticated`, dan `service_role`, sedangkan halaman aplikasi memanggil RPC dengan service-role client di server. Terapkan `supabase/leaderboard.sql` pada database tujuan; file migration di repository bukan bukti database live sudah diperbarui.

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

### Audio TTS dan Speech-to-Text

- Audio dibuat dengan Microsoft Edge TTS. Audio English mendukung aksen US (`en-US`) dan UK (`en-GB`); German menggunakan `de-DE`. MP3 dan manifest yang dipublikasikan di repository terpisah `nandayudhistirawibowo/nduniverse-audio` diakses melalui jsDelivr.
- `scripts/generate-tts-en.py` mengumpulkan teks dari konten materi/ujian/karier dan halaman Grammar/Pronunciation EN/DE; `scripts/generate-boss-tts.py` menangani voice line Boss Fight. Dry-run memeriksa file lokal, bukan mengirim request HTTP/HEAD ke jsDelivr. Inventaris generator umum saat ini melampaui 22.000 output teks/voice dan berubah saat konten diperbarui; dry-run bukan verifikasi publikasi CDN.
- URL TTS umum memakai SHA-256 dari teks ternormalisasi; Boss Fight memakai MD5. Resolver ada di `src/core/audio/cdn-audio.js`; MP3/manifest terbit di jsDelivr dan audio statis di-resolve melalui manifest.
- Boss Fight menggunakan voice acting audio TTS untuk dialog HRD; generatornya tersedia melalui `npm run generate:tts:boss`.
- Jika MP3 gagal dimuat atau menghasilkan 404, pemutar menggunakan Web Speech API (`window.speechSynthesis`) dengan `en-US` untuk English US dan `de-DE` untuk German; rute aksen UK memakai `en-GB`. Jika browser tidak mendukung fallback, error dicatat.
- Rekaman microphone memakai `MediaRecorder` dan dikirim ke endpoint server `POST /api/transcribe` (maksimal 10 MB; 30 permintaan/IP/menit). Browser meminta `noiseSuppression`, `echoCancellation`, dan `autoGainControl`; band-pass memakai high-pass 80 Hz dan low-pass 8 kHz. Pre-roll buffer 1.500 ms merekam sebelum VAD aktif; dynamic VAD mengukur noise floor dan memakai hangover 800 ms untuk kata tunggal atau 2.000 ms untuk kalimat.
- Endpoint mencoba Groq Whisper (`whisper-large-v3-turbo`), lalu Speechmatics Batch API; bila keduanya gagal, capture hook menggunakan browser Web Speech API. `src/core/speech/match.ts` mendukung exact, phonetic, dan fuzzy matching, termasuk variasi bunyi umum pada aksen Indonesia. Locale pengenalan mengikuti route: `en-US` dan `de-DE`.
- API keys `GROQ_API_KEY` dan `SPEECHMATICS_API_KEY` harus disimpan di environment server, tidak di client bundle. Header `Permissions-Policy` pada `vercel.json` mengizinkan microphone pada origin sendiri.

### Leaderboard

- Halaman terproteksi tersedia di `/en/leaderboard` dan `/de/leaderboard`, dengan podium Top 3 dan daftar maksimal 100 pengguna.
- Supabase RPC `get_leaderboard` menjumlahkan XP, mengecualikan total XP 0 dan nama/NIM yang mengandung `admin` secara case-insensitive, lalu mengurutkan `profiles.current_level DESC` dan total XP `DESC`.
- UI berlangganan Realtime `postgres_changes` untuk INSERT/UPDATE pada `user_progress` dan `profiles`. SQL memberi grant execute kepada `anon`, `authenticated`, dan `service_role`; aplikasi memanggil RPC server-side menggunakan service-role client. Jalankan `supabase/leaderboard.sql` pada project target. File SQL di repository tidak membuktikan schema live sudah diterapkan.

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

- Dashboard EN dan DE menampilkan XP, kemajuan level CEFR, serta daftar progres materi dengan progress bar, persentase berdasarkan XP dari `user_progress.xp` (cap 800), dan XP dalam format `xp / 800 XP`. Halaman materi menampilkan status pilar biner 100%/0%.
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
| Speech-to-text | Groq Whisper, Speechmatics Batch API (`@speechmatics/batch-client`), Web Speech API |
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
