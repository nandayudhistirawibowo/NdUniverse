# NdUniverse

NdUniverse adalah platform belajar bahasa Jerman dan Inggris berbasis Astro. UI menggunakan Bahasa Indonesia secara hardcoded (Indonesian-first) tanpa sistem i18n. Tautan `/en` dan `/de` hanya navigasi antar modul pembelajaran, bukan pengubah bahasa UI. Materi belajar tetap memakai bahasa target.

## Status V4

**V4 selesai 100% untuk lingkup rilis.** Produk mencakup modul German dan English, latihan empat pilar tanpa urutan wajib, ujian dengan anti-cheat fullscreen, progress Supabase, serta chatbot RAG.

## Fitur

- **German (`/de`)**: Alltagsdeutsch A1-C2, Fachdeutsch, Goethe, Career, dan Boss Fight.
- **English (`/en`)**: Everyday dan Academic English, IELTS/TOEFL, serta Career.
- **Latihan empat pilar**: pilih sesi dan Reading, Listening, Writing, atau Speaking secara bebas. Progres tiap pasangan sesi-pilar disimpan, misalnya `s1-reading`.
- **NdBot v2 (RAG)**: Supabase `pgvector` mengambil materi relevan; Cloudflare Workers AI membuat embedding dan Groq membantu penulisan ulang query serta jawaban.
- **Anti-cheat ujian**: mode fullscreen mencatat pelanggaran; NdBot menampilkan status dan ujian dikirim otomatis pada strike ketiga. NdBot juga mengunci chat pada mode kuis, tanpa mengunci pilihan materi/sesi/pilar berdasarkan progres.
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
| Konten | Astro Content Collections, Markdown, Zod |
| Audio/CDN | Edge TTS dan jsDelivr |
| Styling | CSS |

## Menjalankan Proyek

Persyaratan: Node.js `>=22.23.4`.

```bash
npm install
npx astro dev --background
```

Server background dapat dikelola dengan `npx astro dev status`, `npx astro dev logs`, dan `npx astro dev stop`. Sebelum menguji fitur yang memerlukan backend, siapkan variabel environment yang sesuai (lihat [HANDOVER.md](HANDOVER.md)). Untuk validasi produksi:

```bash
npm run build
```

Jangan commit `.env`, service-role key, Groq API key, atau Cloudflare API token.

## Memperbarui Audio dan Manifest CDN

Audio terbit di repository terpisah `nandayudhistirawibowo/nduniverse-audio` di bawah `audio/`. Aplikasi membaca manifest TTS German (`audio/tts/manifest.json`) serta English (`audio/tts-en-us/manifest-en-us.json` dan `audio/tts-en-gb/manifest-en-gb.json`) melalui jsDelivr. Peta umum audio ujian berada di `manifest-cdn.json` repository ini.

1. Preview audio English yang belum ada dengan `npm run generate:tts:en -- --dry-run`; jalankan `npm run generate:tts:en` untuk membuat kedua aksen, manifest `manifest-en-us.json`/`manifest-en-gb.json`, dan memperbarui `manifest-cdn.json`. Dependensi: `python -m pip install -r requirements-tts.txt`. Generator German `npm run generate:tts` masih menunjuk ke sumber legacy `src/content/materi`; periksa path sebelum menggunakannya untuk konten modular V4.
2. Salin aset dan manifest yang akan diterbitkan ke direktori sepadan di `nduniverse-audio/audio/`. Pertahankan nama file dan format mapping teks-ke-path pada manifest.
3. Commit dan push repository audio ke branch `main`, lalu tunggu jsDelivr menyajikan versi terbaru.
4. Untuk memperbarui peta MP3 umum, siapkan checkout repo audio pada `D:\audio-cdn` (sehingga foldernya `D:\audio-cdn\audio`), lalu jalankan dari root NdUniverse:

   ```bash
   python scripts/migrate-audio-cdn.py
   ```

   Script ini membuat ulang `manifest-cdn.json`; commit dan push file tersebut ke branch aplikasi yang digunakan. Jangan hapus entri yang masih dipakai.

## Memperbarui Indeks RAG

Perubahan Markdown tidak otomatis memperbarui indeks. Lihat [HANDOVER.md](HANDOVER.md) untuk persiapan, variabel environment, dan langkah ingest. Ingest penuh menggunakan `--replace-all` dan menghapus seluruh baris `public.documents` sebelum mengisi ulang.

## Sitemap dan Crawler

Landing memakai `index, follow`; layout dashboard memakai `noindex, nofollow`. Sitemap mencakup `/`, `/de`, `/en`, halaman login, dan materi; rute dashboard/admin difilter. `robots.txt` melarang crawl admin, API, dan beberapa rute dashboard. Catatan: daftar saat ini masih memuat rute DE lama `/de/dashboard/`; dashboard DE aktif berada di `/dashboard-de`.

## Dokumentasi

- [Konsep Desain Frontend](FRONTEND_DESIGN_CONCEPT.md)
- [PRD](PRD.md)
- [ERD](ERD.md)
- [Flowchart](FLOWCHART.md)
- [Handover](HANDOVER.md)
- [Pengujian](TESTING.md)
