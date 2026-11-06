# siDeutsch

siDeutsch adalah platform belajar bahasa Jerman untuk mahasiswa Indonesia. Materi mencakup percakapan sehari-hari dan kosakata bidang studi, dari level CEFR A1 sampai C2. Latihan dibagi menjadi sesi singkat dengan kuis interaktif dan progress tersimpan untuk pengguna yang masuk.

## Fitur

- **Alltagsdeutsch dan Fachdeutsch:** materi umum dan kosakata sesuai jurusan.
- **Panduan belajar:** abjad dan pengucapan, umlaut, diphthong, serta tata bahasa dasar hingga kasus.
- **Audio pengucapan:** Web Speech API browser dengan locale `de-DE` pada kata dan kalimat bahasa Jerman.
- **Kuis bertahap:** susun kata, Word Matcher, dan cloze; setiap sesi berisi maksimal lima kosakata.
- **Progress belajar:** XP, nyawa, sesi lulus, dan catatan; progress akun disinkronkan ke Supabase.
- **Guest Mode:** preview materi dan latihan Sesi 1 tanpa akun.
- **Dashboard mahasiswa dan admin:** katalog, profil, progress, dan pengelolaan akun mahasiswa.
- **Navigasi responsif:** Astro ClientRouter, prefetch hover, dan indikator loading.

## Tech Stack

- Astro 7 dengan SSR (`output: "server"`) dan adapter Vercel.
- Preact untuk komponen kuis interaktif.
- Supabase Auth, Postgres, Storage, `@supabase/ssr`, dan `@supabase/supabase-js`.
- Astro Content Collections untuk materi Markdown dengan validasi Zod.
- CSS murni dengan custom properties; project tidak menggunakan Tailwind atau Alpine.js.
- Web Speech API bawaan browser untuk text-to-speech.
- Node.js `>=22.23.4`.

## Menjalankan Lokal

1. Pasang dependency dengan `npm install`.
2. Atur environment variables berikut di environment lokal:
	- `PUBLIC_SUPABASE_URL`
	- `PUBLIC_SUPABASE_ANON_KEY`
	- `SUPABASE_SERVICE_ROLE_KEY` untuk operasi admin server-side
3. Jalankan `npm run dev`.
4. Buka `http://localhost:4321`.

Build produksi dijalankan dengan `npm run build`; preview build memakai `npm run preview`. Jangan commit nilai secret atau mengirim `SUPABASE_SERVICE_ROLE_KEY` ke browser.

## Struktur Penting

- `src/layouts/`: layout publik dan dashboard.
- `src/components/`: portal auth, katalog dashboard, kuis, dan kontrol speaker grammar.
- `src/pages/`: route publik, materi, latihan, dashboard, admin, dan API admin.
- `src/content/materi/`: materi Alltagsdeutsch dan Fachdeutsch dalam Markdown.
- `src/lib/`: helper admin dan progress Supabase.
- `src/middleware/`: pembuatan Supabase server client dan proteksi route.
- `supabase/`: SQL progress dan migrasi level lama.

## Dokumentasi

- [Product Requirements Document](PRD.md)
- [Entity Relationship Diagram](ERD.md)
- [Flowchart aplikasi](FLOWCHART.md)
- [Handover untuk DeepSeek](HANDOVER_DEEPSEEK.md)
- [Handover untuk Copilot](HANDOVER_COPILOT.md)
- [Dokumentasi Astro](https://docs.astro.build/)
- [Dokumentasi Supabase](https://supabase.com/docs)