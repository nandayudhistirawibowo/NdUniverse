# NdUniverse

Platform pembelajaran bahasa Jerman dan Inggris untuk persiapan akademik, sertifikasi, dan karir global.

## Status V4

- **V4: Selesai 100% untuk lingkup rilis.** Mencakup modul belajar Jerman dan Inggris, chatbot RAG, progress dan XP, ujian, serta flow kuis 4 pilar.
- Materi belajar dan audio tersedia lewat aset aplikasi dan CDN jsDelivr sesuai modul.

NdUniverse adalah platform induk dengan gerbang utama di `/`, modul German di `/de`, dan modul English di `/en`. Setiap modul dapat memiliki kurikulum, latihan, ujian, Career, dan dashboard sendiri.

## Fitur Utama

### Modul German (`/de`)

- Alltagsdeutsch A1-C2 untuk komunikasi sehari-hari.
- Fachdeutsch untuk kosakata akademik dan profesional.
- Empat pilar CEFR: Reading, Listening, Writing, dan Speaking.
- Simulasi Goethe-Zertifikat dan Mini-Mock Exam.
- Career IT, Business, Health, dan Nutrition.
- Boss Fight Visual Novel untuk latihan wawancara kerja.
- Audio German berbasis Edge TTS dan fallback Web Speech API.

### Modul English (`/en`)

- Everyday dan Academic English serta persiapan ujian IELTS/TOEFL.
- Career Prep dan English Interview Challenge.
- Latihan Reading, Listening, Writing, dan Speaking.
- Audio English disajikan melalui CDN jsDelivr.

### Fondasi Platform

- Landing NdUniverse dan language switch antara `/de` dan `/en`.
- Multi-Language Progress: progress German dan English dipisahkan dengan `language_code` (`de`/`en`).
- XP sementara dibatalkan saat Game Over dan tidak difinalisasi dua kali dalam satu run.
- Flow kuis mengunci empat pilar per sesi secara berurutan: Reading → Listening → Writing → Speaking.
- Chatbot tutor dengan retrieval materi (RAG), embedding Cloudflare Workers AI, dan model Groq.
- Audio dan manifest tertentu didistribusikan melalui jsDelivr.
- Responsive UI untuk desktop, tablet, dan mobile.
- Supabase Auth, PostgreSQL, Storage, dan RLS.

## Tech Stack

- **Framework:** Astro 7 SSR dengan Vercel adapter
- **UI:** Preact 11 dan `@astrojs/preact`
- **Routing:** Astro file-based routing dengan modul bahasa `/de` dan `/en`
- **Database/Auth:** Supabase PostgreSQL, Auth, Storage, dan RLS
- **Chatbot RAG:** Supabase `pgvector` untuk dokumen dan pencarian kemiripan; Cloudflare Workers AI untuk embedding 384 dimensi; Groq untuk rewrite query dan jawaban.
- **CDN:** jsDelivr untuk aset audio dan manifest audio yang dikonfigurasi ke CDN.
- **Multi-language progress:** kolom `user_progress.language_code` dan client progress terpisah untuk `de`/`en`
- **Konten:** Astro Content Collections, Markdown, dan Zod
- **Struktur modul:** `src/core/` untuk sistem platform serta `src/modules/german/` dan `src/modules/english/` untuk modul bahasa
- **Styling:** CSS murni dengan CSS Variables dan Media Queries
- **Audio:** Edge TTS, aset audio melalui jsDelivr, dan Web Speech API
- **PDF:** `html2pdf.js`
- **Hosting:** Vercel dengan `@astrojs/vercel`
- **Client storage:** localStorage untuk bookmark, cache progress, dan status ujian

## Struktur Navigasi

```text
NdUniverse (/)
  -> Pilih Bahasa
      -> German (/de)
          -> Login
          -> Alltagsdeutsch / Fachdeutsch / Career / Ujian
      -> English (/en)
          -> Login
          -> Everyday English / Academic English / Career Prep / Ujian
```

## Struktur Folder Penting

- `src/core/auth/`: Auth, avatar, middleware, dan admin helper.
- `src/core/db/`: progress client German dan English.
- `src/core/ui/`: Layout, dashboard layout, katalog, modal, dan hint universal.
- `src/core/game/`: helper game bersama.
- `src/modules/german/`: komponen, config, dan konten German.
- `src/modules/english/`: komponen, config, materi Everyday/Academic, dan konten Exam Prep IELTS/TOEFL.
- `src/content.config.ts`: Content Collections `englishEveryday` dan `englishExam` serta collection German.
- `src/pages/`: routing Astro; halaman tidak dipindahkan saat refactor.

## Dokumentasi

- [PRD NdUniverse](PRD_NDUNIVERSE.md)
- [PRD Modul German](PRD.md)
- [ERD](ERD.md)
- [Flowchart](FLOWCHART.md)
- [Struktur Data dan Komponen](DATA_STRUCTURE.md)
- [Handover](HANDOVER_NDUNIVERSE.md)
- [Testing](TESTING.md)

## Menjalankan Proyek

Persyaratan Node.js: `>=22.23.4`.

```bash
npm install
npx astro dev --background
```

Kelola server background dengan `npx astro dev status`, `npx astro dev logs`, dan `npx astro dev stop`.

## Audio TTS

Audio German dan English menggunakan Edge TTS. Aset audio yang dikonfigurasi sebagai CDN diambil dari jsDelivr; fallback Web Speech API digunakan jika audio tidak tersedia.

```bash
python -m pip install -r requirements-tts.txt
npm run generate:tts
```

Repository ini sekarang bernama **NdUniverse** sebagai platform induk multi-bahasa.

## Memperbarui Indeks Chatbot

Jika materi Markdown berubah dan perlu diperbarui pada indeks RAG, lihat [Handover](HANDOVER_NDUNIVERSE.md) untuk dependensi, environment variables, dan langkah ingest penuh. Script ingest memakai `--replace-all` yang menghapus seluruh baris `public.documents` sebelum mengisi ulang indeks.

## Testing & Performance

Platform telah diuji dengan k6 pada 100 VUs dan mencatat success rate 100% dengan rata-rata waktu respons 32ms. Lihat [laporan Load Testing](TESTING.md) untuk detail hasil.
