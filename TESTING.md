# Pengembangan dan Pengujian

## Prasyarat

- Node.js `>=22.23.4`
- Dependensi proyek terpasang dengan `npm install`
- Browser Chromium diunduh oleh Playwright jika belum tersedia

Tidak ada script `test` di `package.json`; gunakan Playwright secara langsung.

## Build

```bash
npm run build
```

Project memakai Vercel adapter. Untuk mencoba hasil build lokal, jalankan server output Vercel:

```bash
node scripts/serve-vercel-output.mjs
```

Server default tersedia di `http://127.0.0.1:4321`; variabel `PORT` dapat digunakan untuk memilih port lain.

## Playwright aplikasi

Jalankan semua tes:

```bash
npx playwright test
```

Jalankan satu file atau tes bernama tertentu:

```bash
npx playwright test tests/auth.spec.ts
npx playwright test tests/quiz-core.spec.ts --grep "nama tes"
```

Konfigurasi di `playwright.config.ts` membangun aplikasi dan menyalakan server output Vercel di port 4321 jika server tersebut belum berjalan. Hasil HTML tersedia melalui:

```bash
npx playwright show-report
```

Artefak tes disimpan di `test-results/`; laporan HTML disimpan di `playwright-report/`. Keduanya adalah keluaran run, bukan dokumentasi status terkini.

## Tes keamanan lokal

Folder `security/` dan seluruh isinya sengaja di-ignore oleh Git. Jika suite lokal tersebut tersedia di checkout, buat `security/.env.security` berisi kredensial akun tes sesuai dokumentasi lokalnya, lalu jalankan:

```bash
npx playwright test --config=security/playwright.config.ts
```

Suite ini menyalakan Astro dev server pada port 4321 dan menulis laporan ringkas ke `security/report.txt`. Jangan memakai akun/data produksi atau menyimpan kredensial di repository. Jika folder tersebut tidak ada pada checkout, langkah ini tidak tersedia.

## Load test

`load-test.js` menggunakan k6 dengan 100 virtual users selama satu menit. Script saat ini memiliki URL production yang ditulis langsung di dalam file. Jangan jalankan terhadap production tanpa otorisasi eksplisit dan koordinasi; hasil lama di `tests/grafana-k6-testing.md` adalah catatan historis, bukan status performa terkini.
