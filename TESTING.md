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

File yang tersedia:

- `auth.spec.ts` dan `dashboard.spec.ts` — autentikasi dan dashboard.
- `fuzzy-match.spec.ts` — toleransi penilaian jawaban teks.
- `quiz-core.spec.ts` — alur kuis.
- `exam-english.spec.ts` dan `exam-goethe.spec.ts` — ujian.
- `career-bossfight.spec.ts` — Career Boss Fight.
- `e2e-promo.spec.ts` dan `e2e-comprehensive.spec.ts` — perjalanan promo dan pemeriksaan lintas halaman.

Saat audit dokumentasi ini, belum ada tes otomatis khusus untuk izin mikrofon, transkripsi Groq/Speechmatics/Web Speech, pemutaran audio, atau leaderboard; tes Career Boss Fight yang ada tidak membuktikan alur audio/STT.

### Regresi TTS, grading, dan dashboard

- Jalankan `python scripts/generate-tts-en.py --dry-run` untuk mengaudit output TTS lokal. Log ekstraksi Grammar/Pronunciation harus mencantumkan halaman EN dan DE. Dry-run memeriksa file lokal dan tidak melakukan HTTP/HEAD ke jsDelivr; ia bukan pemeriksaan status CDN.
- Jalankan `python scripts/generate-boss-tts.py --dry-run` untuk mengaudit dialog serta pertanyaan Boss Fight. Dry-run tidak menghasilkan file audio.
- `fuzzy-match.spec.ts` menguji aturan pencocokan; saat memeriksa soal grammar, pastikan prompt yang spesifik mempertahankan artikel, sementara soal biasa tetap menoleransi artikel.
- `dashboard.spec.ts` mencakup alur dashboard. Untuk memverifikasi perubahan progres secara visual/interaktif, gunakan akun tes atau fixture progress: bar/persen mengikuti pilar lulus, status pilar di halaman materi biner 100%/0%, kartu progres/dashboard menampilkan `xp / maxXp XP` (mengikuti model 50 XP per pilar, 200 XP per sesi, `jumlah sesi × 200 XP`), dan event progress memperbarui tampilan.
- Fallback Web Speech perlu diuji di browser dengan dukungan `window.speechSynthesis`; kegagalan CDN tidak dapat dibuktikan hanya dengan build. Jangan memublikasikan MP3 atau memanggil layanan TTS saat hanya ingin menjalankan dry-run.

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

### Memeriksa izin mikrofon dan header di Playwright

Header `Permissions-Policy` dikonfigurasi untuk mengizinkan mikrofon pada origin sendiri. Karena aturan `vercel.json` diterapkan oleh deployment, jalankan pemeriksaan header pada URL HTTPS Vercel Preview, bukan hanya Astro dev server lokal. Contoh tes sementara:

```ts
import { test, expect } from '@playwright/test';

const previewUrl = process.env.PREVIEW_URL;

test('Vercel Preview mengizinkan microphone pada origin sendiri', async ({ browser }) => {
  test.skip(!previewUrl, 'Set PREVIEW_URL ke URL HTTPS Vercel Preview.');
  const context = await browser.newContext({ permissions: ['microphone'] });
  const page = await context.newPage();
  const response = await page.goto(previewUrl!);
  expect(response?.headers()['permissions-policy']).toContain('microphone=(self)');
  await context.close();
});
```

Simpan contoh itu sementara sebagai `tests/permissions-policy.spec.ts`, lalu jalankan `npx playwright test tests/permissions-policy.spec.ts` dengan `PREVIEW_URL` menunjuk ke deployment Preview. Pemeriksaan ini memverifikasi header dan izin browser, bukan kualitas pengenalan ucapan. Untuk mencoba perekaman nyata, gunakan akun tes yang sudah login, izinkan mikrofon, lalu uji pada halaman Speaking/Boss Fight melalui HTTPS; pastikan key provider tersedia di environment Preview. Respons API dapat di-mock untuk menguji tampilan feedback tanpa mengirim audio ke penyedia eksternal.

## Tes keamanan lokal

Folder `security/` dan seluruh isinya sengaja di-ignore oleh Git. Jika suite lokal tersebut tersedia di checkout, buat `security/.env.security` berisi kredensial akun tes sesuai dokumentasi lokalnya, lalu jalankan:

```bash
npx playwright test --config=security/playwright.config.ts
```

Suite ini menyalakan Astro dev server pada port 4321 dan menulis laporan ringkas ke `security/report.txt`. Jangan memakai akun/data produksi atau menyimpan kredensial di repository. Jika folder tersebut tidak ada pada checkout, langkah ini tidak tersedia.

## Load test

`load-test.js` menggunakan k6 dengan 100 virtual users selama satu menit. Script saat ini memiliki URL production yang ditulis langsung di dalam file. Jangan jalankan terhadap production tanpa otorisasi eksplisit dan koordinasi; hasil lama di `tests/grafana-k6-testing.md` adalah catatan historis, bukan status performa terkini.
