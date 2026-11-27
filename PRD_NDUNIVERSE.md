# NdUniverse - Product Requirements Document

## Visi

NdUniverse adalah platform induk multi-bahasa yang menghubungkan pembelajaran bahasa, pemahaman budaya, sertifikasi internasional, dan kesiapan karir global dalam satu pengalaman terpadu.

Platform ini menjadi gerbang utama untuk berbagai modul bahasa. Setiap modul dapat memiliki kurikulum, sistem latihan, ujian, autentikasi, dan dashboard yang disesuaikan dengan kebutuhan bahasanya, tanpa kehilangan identitas utama NdUniverse.

## Status Rilis

- Source saat ini menyediakan modul German dan English dengan materi belajar, latihan, ujian, dan progress pada route yang tersedia.
- NdBot v2 berbasis RAG, audio English dua aksen, latihan empat pilar tanpa urutan/locking paksa, dan anti-cheat ujian tiga strike termasuk dalam lingkup fitur.
- Status deployment, migrasi database, dan kesiapan rilis harus diverifikasi pada environment tujuan; dokumen ini tidak mengklaim validasi production.

## Target User

- Pelajar dan mahasiswa yang ingin membangun kemampuan bahasa untuk studi atau mobilitas internasional.
- Profesional yang memerlukan kemampuan bahasa untuk karir global.
- Peserta ujian bahasa yang mempersiapkan sertifikasi internasional.
- Pembelajar mandiri yang membutuhkan materi terstruktur dari tingkat dasar hingga mahir.
- Institusi pendidikan dan komunitas yang membutuhkan ruang belajar bahasa yang terukur.

## Modul Bahasa

### German

Route utama: `/de`

Modul German adalah modul aktif utama, dengan fokus pada:

- Alltagsdeutsch untuk komunikasi sehari-hari tingkat A1-C2.
- Fachdeutsch untuk kosakata akademik dan profesional.
- Empat pilar CEFR: Reading, Listening, Writing, dan Speaking.
- Persiapan Goethe-Zertifikat dan simulasi ujian per level.
- Career dan Boss Fight untuk latihan wawancara kerja berbahasa Jerman.
- Audio bahasa Jerman berbasis aset Edge TTS yang sudah tersedia.
- TTS 2 Tombol (Kata & Kalimat).
- Mobile Touch Target 44px untuk kontrol interaktif pada layar kecil.

### English

Route utama: `/en`

Modul English tersedia, dengan fokus produk pada:

- Persiapan IELTS dan TOEFL.
- Latihan Reading, Listening, Writing, dan Speaking.
- Materi akademik dan komunikasi profesional.
- Simulasi ujian dengan penilaian dan feedback terukur.
- Pengembangan aset audio bahasa Inggris melalui Edge TTS.

Route Everyday English, Academic English, Career Prep, dan Exam Prep IELTS/TOEFL tersedia. Produksi audio English memakai Edge TTS dengan voice `en-US` atau `en-GB`; aset yang dikonfigurasi sebagai CDN disajikan melalui jsDelivr.

## Struktur Navigasi

```text
Landing NdUniverse (/)
  -> Pilih Bahasa
      -> English (/en)
          -> Login / Masuk
          -> Dashboard English
              -> Leaderboard
      -> German (/de)
          -> Login / Masuk
          -> Dashboard German
              -> Alltagsdeutsch
              -> Fachdeutsch
              -> Ujian dan Sertifikasi
              -> Career
              -> Leaderboard
```

Landing page mengenalkan produk dan menyediakan kartu modul yang menautkan langsung ke `/login-en` dan `/login-de`. Route `/en` dan `/de` menjadi halaman modul; tautan antar-route tersebut hanya navigasi modul, bukan pengubah bahasa UI.

## Prinsip Produk

- **Modular:** setiap bahasa dapat berkembang sebagai modul mandiri di bawah NdUniverse.
- **Terukur:** kurikulum, latihan, dan ujian mengikuti standar internasional seperti CEFR, IELTS, TOEFL, dan Goethe-Zertifikat.
- **Berorientasi tujuan:** pembelajaran diarahkan ke studi, sertifikasi, komunikasi, dan karir.
- **Cross-device:** pengalaman harus nyaman di desktop, tablet, dan mobile.
- **Konsisten:** NdUniverse menjadi identitas induk, sementara modul bahasa memiliki konten dan alur khusus.
- **Bertahap:** landing mengarahkan user ke login modul, lalu dashboard mengatur perjalanan belajar.
- **Kurikulum dan XP:** standar materi adalah 4 sesi × 5 kosakata = 20, menghasilkan maksimal 800 XP (10 XP per kosakata per pilar; 4 pilar). Alltagsdeutsch dan Everyday English sudah 20 kata per materi; sebagian Academic English masih 17–19 kata. XP di-cap 800 di runtime/UI dan pengguna tidak mendapat XP saat mengulang sesi yang sudah menuntaskan empat pilarnya; progress pilar biner 0%/100%.
- **Tampilan pencapaian:** dashboard/katalog EN/DE mengambil XP dari `user_progress.xp`, menerapkan `Math.min(800, db_xp)`, lalu menampilkan `Math.round((current_xp / 800) * 100)` dan `current_xp / 800 XP`. Saat cap tercapai, nilai wajib 100% dan bar penuh.
- **Interaksi:** Enter mengirim/memeriksa jawaban teks dan Shift+Enter membuat baris baru pada textarea. Filter level katalog EN/DE case-insensitive dan berjalan tanpa reload.

## Fondasi Teknis

- Landing root berada di `src/pages/index.astro` dan tidak memakai sidebar atau navbar dashboard.
- Route modul awal berada di `src/pages/en/index.astro` dan `src/pages/de/index.astro`.
- Layout publik memakai branding NdUniverse.
- Platform menggunakan Supabase untuk auth, database, storage, dan progress; audio yang dikonfigurasi CDN disajikan melalui jsDelivr.
- Chatbot memakai Supabase `pgvector` untuk retrieval, Cloudflare Workers AI untuk embedding, dan Groq untuk query rewrite serta jawaban berbasis materi.
- Input speaking memakai Groq Whisper, fallback Speechmatics Batch API, lalu Web Speech API; phonetic matching memberi toleransi pada variasi pengucapan.
- STT memakai browser noise suppression/echo cancellation/auto gain, band-pass high-pass 80 Hz + low-pass 8 kHz, pre-roll buffer 1.500 ms sebelum VAD aktif, dan hangover dinamis 800 ms (kata tunggal) atau 2.000 ms (kalimat).
- Penilaian teks memakai fuzzy matching untuk typo. Artikel `the/a/an` dan `der/die/das` tidak lagi menjadi entri kosakata; prompt grammar yang dikenali `isArticleQuestion` tetap mensyaratkan artikel.
- Microsoft Edge TTS menghasilkan audio English US/UK, German, dan voice line Boss Fight. Generator umum memeriksa ketersediaan file secara lokal dan mencakup halaman Grammar/Pronunciation; MP3 yang dipublikasikan di-host pada `nduniverse-audio` melalui jsDelivr. Dry-run tidak melakukan HTTP/HEAD ke jsDelivr.
- Leaderboard EN/DE menampilkan Top 100 berdasarkan level dan XP melalui RPC yang mengecualikan nama/NIM berisi `admin` dan pengguna 0 XP; UI realtime memakai Supabase `postgres_changes`. `supabase/leaderboard.sql` memberi grant kepada `anon`, `authenticated`, dan `service_role`, tetapi aplikasi memanggilnya server-side menggunakan service-role client; terapkan SQL pada project tujuan.
- NdBot memiliki prompt guardrails terhadap pembahasan/kebocoran kode dan arsitektur; keluhan teknis diarahkan ke WhatsApp Admin. Ini kebijakan prompt, bukan kontrol akses data.
- XP kuis sementara dibatalkan saat Game Over dan dilindungi dari finalisasi ganda pada run yang sama.
- Schema `user_progress.xp` memiliki batas bawah non-negatif, tetapi tidak memiliki constraint maksimum 800; migration cap membersihkan data lama sekali, sedangkan runtime/UI tetap melakukan clamp.
- UI Indonesian-first: Bahasa Indonesia hardcoded tanpa sistem i18n. Dashboard dan NdBot menggunakan Bahasa Indonesia penuh; landing/portal/login masih memiliki sisa English copy yang masuk backlog audit. Materi belajar tetap memakai bahasa target.
- Kuis mengizinkan pemilihan sesi dan pilar tanpa prasyarat atau urutan wajib; `sessions_passed` hanya menandai progres.
- SEO: landing `index, follow` dan canonical; dashboard `noindex, nofollow` serta dikecualikan dari sitemap.
