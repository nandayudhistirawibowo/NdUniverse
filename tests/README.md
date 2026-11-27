# Panduan Tes NdUniverse

Dokumen ini mencatat suite Playwright yang dikelola di `tests/`. Prasyarat, konfigurasi server, dan tes keamanan lokal dijelaskan lebih lengkap di [../TESTING.md](../TESTING.md).

## Menjalankan tes

```bash
npx playwright test
npx playwright test tests/dashboard.spec.ts
npx playwright test tests/fuzzy-match.spec.ts
```

`playwright.config.ts` membangun aplikasi dan menyajikan output Vercel sebelum tes saat server belum tersedia. File suite mencakup autentikasi, dashboard, kuis, ujian English/Goethe, Career Boss Fight, dan perjalanan end-to-end.

## Cakupan fitur terkait

- `fuzzy-match.spec.ts` memeriksa toleransi typo, normalisasi artikel untuk soal biasa, serta pemertahanan artikel pada prompt grammar yang memang mengujinya.
- `dashboard.spec.ts` menguji route dan perilaku dashboard. Gunakan fixture/akun tes dengan XP 0, antara, 800, dan di atas 800 untuk memastikan persentase memakai `Math.round((min(800, xp) / 800) * 100)`, bar penuh pada 800, dan tampilan `xp / 800 XP`. Status pilar halaman materi tetap biner 100%/0%.
- Pemeriksaan manual: ulangi sesi yang keempat pilarnya telah selesai dan pastikan XP tidak bertambah; cek Enter-to-submit pada input/textarea serta Shift+Enter untuk baris baru; cek filter katalog Semua Level/A1–C2 case-insensitive tanpa reload. Leaderboard harus mengecualikan total XP 0 dan nama/NIM yang mengandung `admin` serta menyegarkan hasil dari `postgres_changes`.
- Pemeriksaan STT real-time diperlukan untuk pre-roll 1.500 ms, band-pass 80 Hz–8 kHz, dan hangover 800/2.000 ms; build bukan bukti perilaku audio tersebut.
- TTS, kegagalan request CDN, izin mikrofon, dan transkripsi langsung provider memerlukan pemeriksaan browser/integrasi tersendiri; `npm run build` saja tidak membuktikan perilaku runtime tersebut. Hindari credential produksi saat menguji provider.
