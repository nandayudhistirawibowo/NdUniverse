# NdUniverse

NdUniverse adalah platform belajar bahasa Jerman dan Inggris berbasis Astro. UI menggunakan Bahasa Indonesia secara hardcoded (Indonesian-first) tanpa sistem i18n. Tautan `/en` dan `/de` hanya navigasi antar modul pembelajaran, bukan pengubah bahasa UI. Materi belajar tetap memakai bahasa target.

## Status V4

Lingkup fitur V4 yang didokumentasikan mencakup modul German dan English, latihan empat pilar tanpa urutan wajib, ujian dengan anti-cheat fullscreen, progress Supabase, chatbot RAG, transkripsi ucapan dengan fallback, leaderboard Top 100, serta Cinematic Boss Fight dengan voice acting TTS dan typewriter sync. Status deployment dan konfigurasi layanan eksternal bergantung pada environment masing-masing.

## Fitur

- **German (`/de`)**: Alltagsdeutsch A1-C2, Fachdeutsch, Goethe, Career, dan Boss Fight.
- **English (`/en`)**: Everyday dan Academic English, IELTS/TOEFL, serta Career.
- **Latihan empat pilar**: pilih sesi dan Reading, Listening, Writing, atau Speaking secara bebas. Progres tiap pasangan sesi-pilar disimpan, misalnya `s1-reading`, digabung (union) saat disinkronkan agar progres pilar lain tidak tertimpa. Status pilar di UI biner: 100% jika pilar tuntas, 0% jika belum.
- **Kurikulum dan XP materi**: standar sesi adalah 4 sesi × 5 kosakata (20 kosakata); 50 XP per pilar × 4 pilar × 4 sesi menghasilkan batas 800 XP per materi. Kuis tidak memberi XP jika seluruh empat pilar pada sesi itu sudah tuntas, dan XP ditampilkan dengan cap 800. Data Alltagsdeutsch dan Everyday English saat ini berisi 20 kosakata per materi; beberapa materi Academic English masih berisi 17–19 kosakata dan karenanya perlu dilengkapi untuk mencapai 800 XP.
- **NdBot v2 (RAG)**: Supabase `pgvector` mengambil materi relevan; Cloudflare Workers AI membuat embedding dan Groq membantu penulisan ulang query serta jawaban. Prompt melarang NdBot membahas atau membocorkan istilah teknis, kode, dan arsitektur; keluhan teknis diarahkan ke WhatsApp Admin.
- **Anti-cheat ujian**: mode fullscreen mencatat pelanggaran; NdBot menampilkan status dan ujian dikirim otomatis pada strike ketiga. NdBot juga mengunci chat pada mode kuis, tanpa mengunci pilihan materi/sesi/pilar berdasarkan progres.
- **Cinematic Boss Fight**: wawancara karier memakai adegan overlay memenuhi viewport, audio TTS untuk dialog HRD, dan typewriter yang diselaraskan dengan durasi audio.
- **Advanced Speech-to-Text**: rekaman dikirim ke Groq Whisper (`whisper-large-v3-turbo`), dengan fallback Speechmatics Batch API lalu Web Speech API. Phonetic matching membantu mengenali variasi pengucapan, termasuk aksen Indonesia.
- **STT**: browser meminta `noiseSuppression`, `echoCancellation`, dan `autoGainControl`; filter band-pass high-pass 80 Hz/low-pass 8 kHz, mengukur noise floor, menyimpan pre-roll 1.500 ms sebelum VAD mendeteksi suara, lalu memakai hangover 800 ms untuk kata tunggal atau 2.000 ms untuk kalimat.
- **Grading fleksibel**: kuis dan ujian memakai fuzzy matching untuk toleransi typo; STT juga membandingkan fonetik untuk variasi aksen. Entri artikel `the/a/an` dan `der/die/das` telah dihapus dari daftar kosakata materi. Artikel diabaikan pada soal biasa, tetapi dipertahankan pada soal grammar yang secara spesifik mengujinya.
- **Leaderboard realtime**: RPC Supabase `get_leaderboard` mengembalikan Top 100 dengan XP > 0, mengecualikan profil yang nama atau NIM-nya mengandung `admin` (case-insensitive), dan mengurutkan level lalu XP. UI berlangganan perubahan `postgres_changes` pada `user_progress` dan `profiles`. SQL memberi grant RPC kepada `anon`, `authenticated`, dan `service_role`; halaman aplikasi memanggilnya melalui service-role client di server.
- **Progress pencapaian**: dashboard/katalog EN dan DE menampilkan persentase XP materi terhadap 800 XP; halaman materi menunjukkan tiap pilar secara biner (100%/0%). Client meng-cap XP pada 800 dan kuis mencegah XP tambahan dari sesi/pilar yang sudah tuntas. `user_progress.xp` memiliki batas non-negatif di schema; `supabase/cap_user_progress_xp.sql` adalah pembersihan data lama satu kali, bukan constraint maksimum database.
- **UI kuis/katalog**: Enter mengirim atau melanjutkan jawaban teks; Shift+Enter membuat baris baru pada textarea. Filter level katalog bekerja instan dan case-insensitive untuk Semua Level serta A1–C2.
- **Bendera modul**: landing memakai SVG `public/flags/gb.svg` dan `public/flags/de.svg`, menjaga tampilan konsisten lintas perangkat tanpa dependency emoji flag.
- **Audio dua aksen**: Microsoft Edge TTS menghasilkan audio `en-US`, `en-GB`, dan German. Nama TTS umum memakai SHA-256 teks ternormalisasi, sedangkan voice line Boss Fight memakai MD5. MP3 dipublikasikan di repository `nandayudhistirawibowo/nduniverse-audio` melalui jsDelivr; Web Speech API menjadi fallback ketika MP3 gagal dimuat atau 404.
- **Progress dan autentikasi**: Supabase Auth/PostgreSQL/Storage dengan pemisahan progress German dan English.

## Tech Stack

| Area | Teknologi |
| --- | --- |
| Framework dan rendering | Astro 7 SSR, Vercel adapter |
| Komponen interaktif | Preact 11 |
| Database dan autentikasi | Supabase PostgreSQL, Auth, Storage, RLS |
| Retrieval | Supabase `pgvector`, tabel `public.documents`, RPC `match_documents` |
| AI | Cloudflare Workers AI (`@cf/baai/bge-small-en-v1.5`, 384 dimensi) dan Groq |
| Speech-to-text | Groq Whisper API, Speechmatics Batch API (`@speechmatics/batch-client`), Web Speech API fallback |
| Konten | Astro Content Collections, Markdown, Zod |
| Audio/CDN | Edge TTS dan jsDelivr |
| Styling | CSS |
| Bendera landing | SVG lokal di `public/flags/` |

## Menjalankan Proyek

Persyaratan: Node.js `>=22.23.4`.

```bash
npm install
astro dev --background
```

Server background dapat dikelola dengan `astro dev status`, `astro dev logs`, dan `astro dev stop`. Sebelum menguji fitur yang memerlukan backend, siapkan variabel environment yang sesuai (lihat [HANDOVER.md](HANDOVER.md)). Untuk validasi produksi:

```bash
npm run build
```

Untuk transkripsi cloud, tambahkan `GROQ_API_KEY` dan `SPEECHMATICS_API_KEY` dari [.env.example](.env.example) ke `.env` lokal. Buat key di [Groq Console](https://console.groq.com/keys) dan [Speechmatics API Keys](https://portal.speechmatics.com/settings/api-keys). Groq dicoba lebih dulu; Speechmatics menjadi fallback server-side, lalu browser memakai Web Speech API jika kedua layanan gagal. Simpan key hanya di environment server dan jangan commit `.env`.

Project menggunakan Vercel adapter, sehingga `astro preview` bukan cara yang didukung untuk menguji hasil deploy adapter ini. Setelah build, jalankan server lokal yang menyajikan output Vercel:

```bash
node scripts/serve-vercel-output.mjs
```

Server tersedia di `http://127.0.0.1:4321` secara default; gunakan `PORT` untuk memilih port lain. Hentikan dengan `Ctrl+C`.

Jangan commit `.env`, service-role key, Groq API key, atau Cloudflare API token.

## Memperbarui Audio dan Manifest CDN

Audio terbit di repository terpisah `nandayudhistirawibowo/nduniverse-audio` di bawah `audio/`. Runtime membentuk URL TTS German dan English dari hash teks; `manifest-cdn.json` memetakan audio statis yang membutuhkan lookup path-ke-URL. Boss Fight memakai `manifest-boss.json` untuk memetakan dialog ke URL CDN. Generator lintas konten juga membuat manifest per bahasa/aksen.

1. `python scripts/generate-tts-en.py --dry-run` mengaudit materi, kuis, ujian, karier, serta teks tombol audio pada halaman Grammar dan Pronunciation EN/DE. Pengecekan ketersediaan memakai file lokal, bukan HTTP/HEAD ke jsDelivr; dry-run mencetak file output yang belum ada. Dengan demikian audit tidak terkena `403 Rate Limit` jsDelivr. Saat generator benar-benar membuat audio, Edge TTS tetap diakses untuk membuat MP3. Jalankan `npm run generate:tts:en` untuk membuat file lokal yang belum ada.
2. Generator memperbarui manifest per bahasa/aksen (`manifest-en-us.json`, `manifest-en-gb.json`, `manifest-de.json`) dan `manifest-cdn.json`. Setelah selesai, generator mencetak daftar file MP3 yang dibuat lokal untuk disinkronkan ke `nduniverse-audio` bila diperlukan.
3. Untuk audio Boss Fight, gunakan `npm run generate:tts:boss -- --dry-run` untuk memeriksa file lokal atau `npm run generate:tts:boss` untuk membuat audio Edge TTS German dan English. Nama file Boss Fight memakai MD5; TTS umum memakai SHA-256 yang sama dengan resolver runtime.
4. Dependensi generator tersedia melalui `python -m pip install -r requirements-tts.txt`. Generator legacy `npm run generate:tts` masih menunjuk ke sumber `src/content/materi` yang tidak tersedia pada struktur aktif; gunakan generator lintas konten di atas.
5. Generator umum mencakup lebih dari 22.000 output teks/voice lintas aksen dan bahasa, termasuk Grammar serta Pronunciation; Boss Fight juga memiliki generator dan folder audio terpisah. Angka aktual berubah bersama konten. Dry-run hanya memastikan keberadaan output di lokal, bukan memverifikasi file pada CDN atau membuktikan semuanya telah dipublikasikan.
6. Salin aset dan manifest yang akan diterbitkan ke direktori sepadan di `nduniverse-audio/audio/`. Pertahankan nama file dan format mapping teks-ke-path pada manifest.
7. Commit dan push repository audio ke branch `main`, lalu tunggu jsDelivr menyajikan versi terbaru.
8. Untuk memperbarui peta MP3 umum, siapkan checkout repo audio pada `D:\audio-cdn` (sehingga foldernya `D:\audio-cdn\audio`), lalu jalankan dari root NdUniverse:

   ```bash
   python scripts/migrate-audio-cdn.py
   ```

   Script ini membuat ulang `manifest-cdn.json`; commit dan push file tersebut ke branch aplikasi yang digunakan. Jangan hapus entri yang masih dipakai. Untuk Boss Fight, generator memperbarui `manifest-boss.json` dan salinan di `public/`.

## Memperbarui Indeks RAG

Perubahan Markdown tidak otomatis memperbarui indeks. Sumber ingest mencakup materi German/English dan subset dokumentasi proyek yang ditentukan di `scripts/ingest-rag.py`. Lihat [HANDOVER.md](HANDOVER.md) untuk persiapan, variabel environment, dan langkah ingest. Ingest penuh menggunakan `--replace-all` dan menghapus seluruh baris `public.documents` sebelum mengisi ulang.

## Menyiapkan Leaderboard Supabase

Setelah skema `user_progress` dan kolom `profiles.current_level` tersedia, jalankan [supabase/leaderboard.sql](supabase/leaderboard.sql) melalui Supabase SQL Editor pada project yang dipakai aplikasi. RPC `get_leaderboard` menjumlahkan XP, mengecualikan pengguna 0 XP serta nama/NIM yang mengandung `admin`, lalu mengembalikan maksimal 100 baris terurut berdasarkan level dan XP. SQL saat ini memberi grant execute ke `anon`, `authenticated`, dan `service_role`; aplikasi memanggil RPC dari server dengan service-role client. Leaderboard juga berlangganan perubahan Supabase Realtime pada tabel progress dan profil.

## Sitemap dan Crawler

Landing memakai title `Belajar Bahasa Jerman & Inggris Gratis | NdUniverse`, description yang mengandung keyword terkait, canonical, Open Graph, Twitter Cards, serta `index, follow`. `src/core/ui/Layout.astro` menerima title, description, image, dan URL per halaman untuk metadata dinamis. Sitemap mencakup `/`, `/de`, `/en`, `/login-de`, `/login-en`, serta materi publik, dan tidak memasukkan dashboard. `robots.txt` mengizinkan `/` serta melarang `/dashboard/`, `/dashboard-de`, `/en/dashboard/`, `/admin/`, dan `/api/`.

## Dokumentasi

### Produk dan desain

- [PRD modul pembelajaran](PRD.md)
- [Visi produk NdUniverse](PRD_NDUNIVERSE.md)
- [Konsep desain frontend](FRONTEND_DESIGN_CONCEPT.md)
- [Rencana pengembangan dan backlog](PLAN.md)

### Arsitektur dan pemeliharaan

- [Peta kode dan alur fitur](CODEBASE_SUMMARY.md)
- [Struktur source dan konten](DATA_STRUCTURE.md)
- [ERD dan model data](ERD.md)
- [Flowchart aplikasi](FLOWCHART.md)
- [Panduan handover dan operasional](HANDOVER.md)

### Validasi

- [Pengembangan dan pengujian](TESTING.md)
- [Catatan historis k6 dan security](tests/grafana-k6-testing.md)
