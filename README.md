# NdUniverse

NdUniverse adalah platform belajar bahasa Jerman dan Inggris berbasis Astro. UI menggunakan Bahasa Indonesia secara hardcoded (Indonesian-first) tanpa sistem i18n. Tautan `/en` dan `/de` hanya navigasi antar modul pembelajaran, bukan pengubah bahasa UI. Materi belajar tetap memakai bahasa target.

## Status V4

Lingkup fitur V4 yang didokumentasikan mencakup modul German dan English, latihan empat pilar tanpa urutan wajib, ujian dengan anti-cheat fullscreen, progress Supabase, chatbot RAG, transkripsi ucapan dengan fallback, leaderboard Top 100, serta Cinematic Boss Fight dengan voice acting TTS dan typewriter sync. Status deployment dan konfigurasi layanan eksternal bergantung pada environment masing-masing.

## Fitur

- **German (`/de`)**: Alltagsdeutsch A1-C2, Fachdeutsch, Goethe, Career, dan Boss Fight.
- **English (`/en`)**: Everyday dan Academic English, IELTS/TOEFL, serta Career.
- **Latihan empat pilar**: pilih sesi dan Reading, Listening, Writing, atau Speaking secara bebas. Progres tiap pasangan sesi-pilar disimpan, misalnya `s1-reading`.
- **NdBot v2 (RAG)**: Supabase `pgvector` mengambil materi relevan; Cloudflare Workers AI membuat embedding dan Groq membantu penulisan ulang query serta jawaban.
- **Anti-cheat ujian**: mode fullscreen mencatat pelanggaran; NdBot menampilkan status dan ujian dikirim otomatis pada strike ketiga. NdBot juga mengunci chat pada mode kuis, tanpa mengunci pilihan materi/sesi/pilar berdasarkan progres.
- **Cinematic Boss Fight**: wawancara karier memakai adegan overlay memenuhi viewport, audio TTS untuk dialog HRD, dan typewriter yang diselaraskan dengan durasi audio.
- **Advanced Speech-to-Text**: rekaman dikirim ke Groq Whisper (`whisper-large-v3-turbo`), dengan fallback Speechmatics Batch API lalu Web Speech API. Phonetic matching membantu mengenali variasi pengucapan, termasuk aksen Indonesia.
- **Futuristic Leaderboard**: podium Top 3 dan daftar hingga 100 pengguna, diurutkan berdasarkan level lalu XP. Data dihitung melalui Supabase RPC server-side yang dibatasi untuk service role agar sesuai dengan kebijakan RLS.
- **Bendera modul**: landing memakai SVG `public/flags/gb.svg` dan `public/flags/de.svg`, menjaga tampilan konsisten lintas perangkat tanpa dependency emoji flag.
- **Audio dua aksen**: Generator English menghasilkan audio `en-US` dan `en-GB`; manifest dan MP3 di repo CDN `nduniverse-audio` disajikan melalui jsDelivr. Web Speech API menjadi fallback.
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

1. `npm run generate:tts:en -- --dry-run` mengaudit teks materi, konteks, soal, ujian, dan konten karier English/German serta menghitung MP3 lokal yang belum tersedia. Jalankan `npm run generate:tts:en` untuk memeriksa keberadaan hash di CDN dan membuat audio yang belum ada. `--skip-cdn-check` dapat digunakan untuk melewati pemeriksaan jaringan.
2. Generator memperbarui manifest per bahasa/aksen (`manifest-en-us.json`, `manifest-en-gb.json`, `manifest-de.json`) dan `manifest-cdn.json`. Setelah selesai, generator mencetak daftar file MP3 yang perlu dipush ke `nduniverse-audio`.
3. Untuk audio Boss Fight, gunakan `npm run generate:tts:boss -- --dry-run` untuk melihat file yang perlu dibuat/push atau `npm run generate:tts:boss` untuk membuat audio TTS German dan English. Nama file Boss Fight memakai MD5; TTS umum memakai hash yang sama dengan resolver runtime.
4. Dependensi generator tersedia melalui `python -m pip install -r requirements-tts.txt`. Generator legacy `npm run generate:tts` masih menunjuk ke sumber `src/content/materi` yang tidak tersedia pada struktur aktif; gunakan generator lintas konten di atas.
5. Salin aset dan manifest yang akan diterbitkan ke direktori sepadan di `nduniverse-audio/audio/`. Pertahankan nama file dan format mapping teks-ke-path pada manifest.
6. Commit dan push repository audio ke branch `main`, lalu tunggu jsDelivr menyajikan versi terbaru.
7. Untuk memperbarui peta MP3 umum, siapkan checkout repo audio pada `D:\audio-cdn` (sehingga foldernya `D:\audio-cdn\audio`), lalu jalankan dari root NdUniverse:

   ```bash
   python scripts/migrate-audio-cdn.py
   ```

   Script ini membuat ulang `manifest-cdn.json`; commit dan push file tersebut ke branch aplikasi yang digunakan. Jangan hapus entri yang masih dipakai. Untuk Boss Fight, generator memperbarui `manifest-boss.json` dan salinan di `public/`.

## Memperbarui Indeks RAG

Perubahan Markdown tidak otomatis memperbarui indeks. Sumber ingest mencakup materi German/English dan subset dokumentasi proyek yang ditentukan di `scripts/ingest-rag.py`. Lihat [HANDOVER.md](HANDOVER.md) untuk persiapan, variabel environment, dan langkah ingest. Ingest penuh menggunakan `--replace-all` dan menghapus seluruh baris `public.documents` sebelum mengisi ulang.

## Menyiapkan Leaderboard Supabase

Setelah skema `user_progress` dan kolom `profiles.current_level` tersedia, jalankan [supabase/leaderboard.sql](supabase/leaderboard.sql) melalui Supabase SQL Editor pada project yang dipakai aplikasi. Script membuat RPC `get_leaderboard`, yang menjumlahkan XP per pengguna dan mengembalikan maksimal 100 baris terurut berdasarkan level menurun lalu XP menurun. Halaman leaderboard memanggil RPC tersebut dari server menggunakan service-role client; jangan memberikan hak eksekusi RPC ini ke browser atau pengguna `anon`/`authenticated`.

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
