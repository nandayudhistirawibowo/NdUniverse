# siDeutsch

Platform belajar bahasa Jerman universal untuk level A1–C2 dengan kuis empat pilar CEFR **Reading, Listening, Writing, dan Speaking**, Career profesional, dan Boss Fight Visual Novel.

## Fitur Unggulan

- **Kuis 4 Pilar CEFR:** Lesen, Hören, Schreiben, dan Sprechen, dengan empat sesi per materi dan lima kosakata per sesi.
- **Simulasi Goethe-Zertifikat:** timer resmi A1–C2, empat modul terpisah, kelulusan 60% per modul, feedback spesifik, dan sertifikat PDF.
- **Mock Exam:** latihan mini 22 task dengan komposisi 10 Lesen, 10 Hören, 1 Schreiben, dan 1 Sprechen.
- **Audio Native:** 8.372 file MP3 statis hasil Edge TTS serta fallback Web Speech API dan bahasa Jerman.
- **Mic to Text:** Speech Recognition browser untuk latihan Speaking.
- **XP dan Anti-Farming:** jawaban benar memberi 10 XP sesi sementara; XP dibatalkan saat Game Over dan tidak difinalisasi dua kali.
- **Dual Track:** Alltagsdeutsch untuk bahasa sehari-hari dan Fachdeutsch untuk kosakata bidang profesional.
- **Career:** empat rumpun profesi IT, Digital Business, Kesehatan, serta Gizi & Kebidanan, masing-masing memiliki 50 kosakata dan 10 pertanyaan Boss Fight.
- **Boss Fight Visual Novel:** Intro ruangan kantor dan pintu animasi, salam HRD, chat interview bertahap, dukungan Mic Speech API, serta layar kemenangan.
- **Bookmark:** menyimpan kosakata sulit secara lokal di browser.
- **Dashboard CEFR:** progress, profil, avatar Private, dan pencapaian 4 pilar.

Koleksi saat ini berisi **425+ file materi** dan sekitar **8.500 kosakata**.

## Tech Stack

- **Framework:** Astro 7 dengan SSR
- **UI Interaktif:** Preact 11 dan `@astrojs/preact`
- **Backend/Database/Auth:** Supabase PostgreSQL, Auth, Storage, dan RLS
- **Konten:** Astro Content Collections, Markdown, dan Zod
- **Styling:** CSS murni dengan CSS variables
- **Audio:** Microsoft Edge TTS untuk file MP3 statis dan manifest, Web Speech API sebagai fallback
- **Sertifikat PDF:** `html2pdf.js`
- **Hosting:** Vercel dengan `@astrojs/vercel`
- **Penyimpanan Client:** localStorage untuk bookmark, cache progress, dan status ujian

## Dokumentasi

- [PRD](PRD.md)
- [ERD](ERD.md)
- [Flowchart](FLOWCHART.md)
- [Handover](HANDOVER.md)

## Menjalankan Proyek

Persyaratan Node.js: `>=22.23.4`.

```bash
npm install
npm run dev
```

## Generate Audio TTS

Pastikan Python dan dependensi Edge TTS tersedia, lalu jalankan generator:

```bash
python -m pip install -r requirements-tts.txt
npm run generate:tts
npm run build
```

File MP3 dan `public/audio/tts/manifest.json` akan disimpan sebagai aset statis. Generator dapat dilanjutkan pada sesi berikutnya jika file awalnya belum lengkap.
