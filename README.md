# siDeutsch

Platform belajar bahasa Jerman interaktif untuk mahasiswa Indonesia.

## 🚀 Fitur Utama
- **Dual-Track Learning:** Alltagsdeutsch (Bahasa Sehari-hari, A1-C2) & Fachdeutsch (Kosakata Jurusan).
- **Career:** Katalog materi kosakata untuk persiapan dunia kerja.
- **Kuis Interaktif:** Variasi tipe soal, XP, tiga nyawa, audio, dan Review Kata Sulit.
- **Bookmark:** Simpan kosakata sulit secara lokal di browser.
- **Web Speech API:** Dengerin pengucapan kata & kalimat langsung dari browser.
- **Panduan Pengucapan & Tata Bahasa:** Lengkap dengan tabel dan penjelasan.
- **Dashboard Mahasiswa & Admin:** Login pakai NIM, sinkronisasi progress ke Supabase.
- **Guest Mode:** Coba materi & kuis tanpa login (progress terbatas).

Koleksi saat ini berisi **425 file materi dan sekitar 8.500 vocab**: 411 Alltagsdeutsch A1–C2, 13 Fachdeutsch, dan 1 Career.

## 🛠️ Tech Stack
- **Framework:** Astro 7 (SSR)
- **UI Components:** Preact 11
- **Database, Auth & Storage:** Supabase
- **Styling:** CSS murni (CSS Variables; tanpa Tailwind)
- **Konten:** Astro Content Collections, Markdown, dan Zod
- **Hosting:** Vercel

## 📖 Dokumentasi
- [PRD](PRD.md)
- [ERD](ERD.md)
- [Flowchart](FLOWCHART.md)
- [Handover DeepSeek](HANDOVER_DEEPSEEK.md)
- [Handover Copilot](HANDOVER_COPILOT.md)

## 🏃 Cara Menjalankan
```bash
npm install
npm run dev
```