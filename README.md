# NdUniverse

NdUniverse adalah platform belajar bahasa Jerman dan Inggris berbasis Astro. Kurikulum tetap menggunakan bahasa target; navigasi dan antarmuka aplikasi menggunakan Bahasa Indonesia hardcoded (tanpa sistem i18n).

## Status V4

**V4 selesai 100% untuk lingkup rilis.** Produk mencakup modul German dan English, latihan empat pilar tanpa urutan wajib, ujian dengan anti-cheat fullscreen, progress Supabase, serta chatbot RAG.

## Fitur

- **German (`/de`)**: Alltagsdeutsch A1-C2, Fachdeutsch, Goethe, Career, dan Boss Fight.
- **English (`/en`)**: Everyday dan Academic English, IELTS/TOEFL, serta Career.
- **Latihan empat pilar**: pilih sesi dan Reading, Listening, Writing, atau Speaking secara bebas. Progres tiap pasangan sesi-pilar disimpan, misalnya `s1-reading`.
- **Chatbot RAG**: Supabase `pgvector` mengambil materi relevan; Cloudflare Workers AI membuat embedding dan Groq membantu penulisan ulang query serta jawaban.
- **Anti-cheat ujian**: mode fullscreen mencatat pelanggaran; NdBot menampilkan status dan ujian dikirim otomatis pada strike ketiga.
- **Audio**: Edge TTS, manifest dan MP3 di repo CDN `nduniverse-audio`, disajikan melalui jsDelivr; Web Speech API menjadi fallback.
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

1. Buat atau perbarui MP3 dan manifest lokal. English menggunakan `npm run generate:tts:en` (dependensi: `python -m pip install -r requirements-tts.txt`); `npm run generate:tts` adalah generator German lama yang masih menunjuk ke `src/content/materi`, jadi periksa path sumber sebelum mengandalkannya untuk konten modular V4.
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

`@astrojs/sitemap` menghasilkan sitemap statis dan mengikutsertakan sitemap materi dinamis `/sitemap-content.xml`. Endpoint tersebut mengambil koleksi materi German, English Everyday, dan English Academic. `public/robots.txt` mengizinkan crawler pada halaman publik dan mengecualikan `/admin/` serta `/api/`.

## Dokumentasi

- [PRD](PRD.md)
- [ERD](ERD.md)
- [Flowchart](FLOWCHART.md)
- [Handover](HANDOVER.md)
- [Pengujian](TESTING.md)
