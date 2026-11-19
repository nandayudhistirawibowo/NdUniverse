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
- `dashboard.spec.ts` menguji route dan perilaku dashboard. Untuk memeriksa progress bar, persentase pilar, sisa XP, dan pembaruan setelah kuis, gunakan fixture atau akun tes dengan progress yang diketahui.
- TTS, kegagalan request CDN, izin mikrofon, dan transkripsi langsung provider memerlukan pemeriksaan browser/integrasi tersendiri; `npm run build` saja tidak membuktikan perilaku runtime tersebut. Hindari credential produksi saat menguji provider.
