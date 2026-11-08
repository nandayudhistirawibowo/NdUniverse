# NdUniverse

Platform Super App multi-bahasa untuk persiapan akademik dan karir global (Jerman dan Inggris).

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

- Everyday English untuk komunikasi sehari-hari.
- IELTS/TOEFL preparation.
- Career Prep dan English Interview Challenge.
- Struktur latihan Reading, Listening, Writing, dan Speaking.
- Komponen English disiapkan terpisah dari komponen German dengan suffix `-en`.

### Fondasi Platform

- Landing NdUniverse dan language switch antara `/de` dan `/en`.
- Multi-Language Progress: progress German dan English dipisahkan dengan `language_code` (`de`/`en`).
- XP, nyawa, anti-farming, bookmark, dan status ujian.
- Responsive UI untuk desktop, tablet, dan mobile.
- Supabase Auth, PostgreSQL, Storage, dan RLS.

## Tech Stack

- **Framework:** Astro 7 SSR dengan Vercel adapter
- **UI:** Preact 11 dan `@astrojs/preact`
- **Routing:** Astro file-based routing dengan modul bahasa `/de` dan `/en`
- **Database/Auth:** Supabase PostgreSQL, Auth, Storage, dan RLS
- **Multi-language progress:** kolom `user_progress.language_code` dan client progress terpisah untuk `de`/`en`
- **Konten:** Astro Content Collections, Markdown, dan Zod
- **Struktur modul:** `src/core/` untuk sistem platform dan `src/modules/german/` untuk konten German
- **Styling:** CSS murni dengan CSS Variables dan Media Queries
- **Audio:** Edge TTS, aset MP3 statis German, dan Web Speech API
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
- `src/modules/german/components/`: komponen German dengan suffix `-de`.
- `src/modules/german/content/`: content collection materi dan Career German.
- `src/components/`: placeholder dan komponen English tahap awal.
- `src/pages/`: routing Astro; halaman tidak dipindahkan saat refactor.

## Dokumentasi

- [PRD NdUniverse](PRD_NDUNIVERSE.md)
- [PRD Modul German](PRD.md)
- [ERD](ERD.md)
- [Flowchart](FLOWCHART.md)
- [Handover](HANDOVER.md)
- [Testing](testing.md)

## Menjalankan Proyek

Persyaratan Node.js: `>=22.23.4`.

```bash
npm install
npx astro dev --background
```

Kelola server background dengan `npx astro dev status`, `npx astro dev logs`, dan `npx astro dev stop`.

## Audio TTS

Audio German yang tersedia menggunakan Edge TTS dan fallback Web Speech API. Untuk modul English, generator berikutnya harus menggunakan Edge TTS dengan voice `en-US` atau `en-GB`; MP3 English belum perlu dibuat pada tahap fondasi.

```bash
python -m pip install -r requirements-tts.txt
npm run generate:tts
```

Repository ini sekarang bernama **NdUniverse** sebagai platform induk multi-bahasa.
