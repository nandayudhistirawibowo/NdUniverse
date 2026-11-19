# Handover NdUniverse V4

## Status

Dokumen ini menggambarkan fitur yang tersedia pada source V4: platform Astro SSR, modul German dan English, latihan bebas pilih sesi/pilar, progress Supabase, chatbot RAG, ujian dengan anti-cheat fullscreen, transkripsi ucapan Groq/Speechmatics dengan fallback Web Speech, leaderboard Top 100, audio CDN, dan Cinematic Boss Fight dengan voice acting TTS serta typewriter sync. Status deployment serta migrasi layanan eksternal harus diverifikasi pada environment tujuan.

Dokumen ini berisi panduan operasional untuk developer selanjutnya. Jangan mengubah credential di repository atau memasukkan secret ke browser.

## Arsitektur Ringkas

- **Aplikasi:** Astro 7 SSR, Preact, Vercel adapter.
- **Database dan auth:** Supabase PostgreSQL, Auth, Storage, RLS.
- **Chatbot RAG:** materi Markdown dipecah menjadi chunk dan disimpan pada `public.documents`; Cloudflare Workers AI menghasilkan embedding `@cf/baai/bge-small-en-v1.5` (384 dimensi), Supabase `pgvector` melakukan retrieval, dan Groq menulis ulang query/menyusun jawaban.
- **Kuis:** pengguna bebas memilih sesi dan pilar. `sessions_passed` menyimpan key seperti `s1-reading` dan `s2-writing` untuk indikator selesai; key tersebut tidak mengunci akses.
- **Ujian besar:** fullscreen anti-cheat memantau perubahan fullscreen, tab tersembunyi, dan window blur. Strike ketiga memaksa submit; NdBot menampilkan status strike.
- **Speech-to-text:** `src/core/speech/` merekam ucapan dan mengirimnya ke `POST /api/transcribe`. Endpoint mencoba Groq Whisper, lalu Speechmatics; jika transkripsi cloud gagal, hook memakai Web Speech API. Phonetic matching membantu toleransi pengucapan. API keys tetap server-side.
- **Leaderboard:** `/en/leaderboard` dan `/de/leaderboard` memakai Supabase RPC `get_leaderboard` untuk menjumlahkan XP dan memilih Top 100. Terapkan `supabase/leaderboard.sql` di Supabase SQL Editor sebelum mengaktifkan halaman.
- **Cinematic Boss Fight:** overlay memenuhi viewport, dengan audio TTS untuk dialog HRD dan typewriter yang diselaraskan dengan audio. Audio Boss Fight dibuat dengan `npm run generate:tts:boss`.
- **Landing:** tombol modul memakai SVG `public/flags/gb.svg` dan `public/flags/de.svg`, bukan emoji, agar konsisten lintas perangkat.
- **UI:** Indonesian-first dengan string hardcoded dan tanpa sistem i18n terpusat. Sidebar, header, navigasi, dan tombol dashboard memakai Bahasa Indonesia; `/en` ↔ `/de` memilih modul pembelajaran, bukan bahasa global UI. Dashboard German berada di `/dashboard-de` dan English di `/en/dashboard`; materi/soal tetap dalam bahasa target. Landing masih memiliki beberapa label pemasaran Inggris yang dapat diaudit jika dibutuhkan.
- **SEO:** landing `index, follow` dengan canonical; layout dashboard `noindex, nofollow`. Sitemap mencakup URL publik dan memfilter admin/dashboard; `robots.txt` melarang crawl rute privat.
- **Audio:** manifest dan MP3 TTS utama disajikan dari `nandayudhistirawibowo/nduniverse-audio` melalui jsDelivr.

## Pengembangan Lokal

Persyaratan Node.js `>=22.23.4`.

```bash
npm install
astro dev --background
astro dev status
npm run build
```

Server background dapat dihentikan dengan `astro dev stop` dan log dibaca dengan `astro dev logs`.

Karena project memakai Vercel adapter, `astro preview` bukan cara yang didukung untuk menguji output deploy adapter ini. Untuk menguji hasil build lokal, jalankan:

```bash
npm run build
node scripts/serve-vercel-output.mjs
```

Server custom menyajikan output `.vercel/output` pada `http://127.0.0.1:4321` (atau port dari `PORT`). Hentikan proses dengan `Ctrl+C`.

Isi `.env` lokal sesuai layanan yang digunakan:

```dotenv
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
SPEECHMATICS_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

`GROQ_API_KEY` didapat dari [Groq Console](https://console.groq.com/keys); `SPEECHMATICS_API_KEY` didapat dari [Speechmatics API Keys](https://portal.speechmatics.com/settings/api-keys). Keduanya dipakai oleh endpoint transkripsi server-side. `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `SPEECHMATICS_API_KEY`, dan `CLOUDFLARE_API_TOKEN` adalah secret; jangan pernah memberi prefix `PUBLIC_` atau mengirimkannya ke browser. Contoh variabel STT juga tersedia di [.env.example](.env.example). Script RAG menerima `SUPABASE_URL` atau `PUBLIC_SUPABASE_URL`.

### Akses mikrofon

`vercel.json` mengirim header `Permissions-Policy: microphone=(self), camera=(self), geolocation=()`. Uji header dan pemberian izin mikrofon pada URL HTTPS Vercel Preview; server Astro lokal tidak selalu menerapkan header deployment. Langkah uji Playwright ada di [TESTING.md](TESTING.md). Web Speech API memerlukan HTTPS atau `localhost`.

## Push dan Deploy

1. Pastikan branch dan remote sesuai repository serta production branch yang dikonfigurasi di Vercel.
2. Tinjau perubahan dan build sebelum commit:

   ```bash
   git status --short
   git diff --check
   npm run build
   ```

3. Stage hanya file yang memang akan dikirim, lalu commit dan push branch:

   ```bash
   git add <file-yang-diubah>
   git commit -m "Ringkasan perubahan"
   git push origin <nama-branch>
   ```

4. Vercel membangun dan deploy setelah push sesuai konfigurasi project. Jangan commit `.env`, token, service-role key, maupun credential pengguna. Jangan memakai force-push untuk mengatasi konflik tanpa koordinasi.

## Memperbarui Audio dan Manifest CDN

Audio MP3 runtime berada di repo terpisah `nandayudhistirawibowo/nduniverse-audio`, dengan struktur di bawah `audio/`:

- German TTS: MP3 di `audio/tts/`, dengan nama berbasis SHA-256 teks ternormalisasi.
- English US/UK: MP3 di `audio/tts-en-us/` dan `audio/tts-en-gb/`, dengan nama berbasis SHA-256 teks serta akhiran locale.
- Audio statis/ujian: folder seperti `audio/exam-listening/`, dirujuk melalui `manifest-cdn.json`.
- Boss Fight: MP3 di `audio/boss/`; `manifest-boss.json` di repository aplikasi memetakan baris dialog ke URL CDN.

Alur publikasi:

1. Jalankan `npm run generate:tts:en -- --dry-run` untuk melihat aset lokal yang kurang atau `npm run generate:tts:en` untuk membuat audio Edge TTS English US/UK dan German, manifest per aksen/bahasa, serta mapping `manifest-cdn.json`. Generator mengumpulkan konten materi, kuis, ujian, karier, halaman Grammar, dan Pronunciation EN/DE. Dry-run memakai pemeriksaan file lokal, bukan HTTP/HEAD ke jsDelivr; karena itu audit tidak terkena `403 Rate Limit`. Generation file baru tetap menghubungi Edge TTS.
2. Untuk voice acting Boss Fight, jalankan `npm run generate:tts:boss -- --dry-run` untuk memeriksa file lokal yang dibutuhkan atau `npm run generate:tts:boss` untuk menghasilkan audio Edge TTS German dan English. Pastikan dependensi TTS pada `requirements-tts.txt` sudah terpasang.
3. Generator German umum `npm run generate:tts` masih membaca sumber legacy `src/content/materi` dan halaman root lama yang tidak ada pada struktur aktif. Perintah ini tidak dapat digunakan pada checkout saat ini, termasuk dalam mode `--dry-run`; jangan mengandalkannya untuk memperbarui audio German. Generator Boss Fight adalah jalur terpisah.
4. Salin aset dan manifest yang akan diterbitkan ke lokasi yang sama di checkout repo audio, misalnya `D:\audio-cdn\audio`. Pertahankan format manifest sebagai mapping teks ke path audio dan pertahankan nama file yang digunakan aplikasi.
5. Commit dan push aset repo audio ke branch `main`:

   ```bash
   git -C D:\audio-cdn status --short
   git -C D:\audio-cdn add audio
   git -C D:\audio-cdn commit -m "Update audio assets"
   git -C D:\audio-cdn push origin main
   ```

6. Setelah MP3 tersedia di repo audio, dari root repository NdUniverse jalankan:

   ```bash
   python scripts/migrate-audio-cdn.py
   ```

   Script tersebut membaca `D:\audio-cdn\audio` dan membangun ulang `manifest-cdn.json` dengan URL jsDelivr. Tinjau diff, lalu commit dan push manifest ke branch aplikasi:

   ```bash
   git status --short
   git add manifest-cdn.json
   git commit -m "Update CDN audio manifest"
   git push origin <branch-aplikasi>
   ```

Generator umum mencakup lebih dari 22.000 variasi teks/voice yang berasal dari materi, kuis, ujian, karier, Grammar, dan Pronunciation; Boss Fight memiliki generator dan folder audio terpisah. Jumlah ini berubah bersama konten. Dry-run menghitung file yang tersedia lokal, bukan memastikan aset di repo audio/CDN telah terbit. Manifest TTS yang dihasilkan untuk inventaris/publikasi bukan lookup runtime untuk TTS berbasis hash. Pastikan MP3 dengan nama/path yang diharapkan tersedia di repo audio. `manifest-cdn.json` memetakan audio statis yang membutuhkan lookup; `manifest-boss.json` memetakan voice line Boss Fight.

### Synchronous Audio Resolver

`src/core/audio/cdn-audio.js` menyediakan URL German/English berbasis teks ternormalisasi dan hash SHA-256, serta resolver path statis melalui `manifest-cdn.json`. `src/modules/english/config/english-speech.js` dan `src/modules/german/config/german-speech.js` memakai URL tersebut dengan browser speech sebagai fallback. Jika format hash, nama file, atau direktori audio diubah, selaraskan generator, resolver, manifest terkait, dan aset CDN.

### Known Issues / Backlog UI

- Jika targetnya konsistensi Bahasa Indonesia penuh, audit kicker, penanda bagian, dan tagline berbahasa Inggris di `src/pages/index.astro`. Teks UI hardcoded; belum ada i18n terpusat.
- NdBot mengunci chat pada mode `quiz` dan `exam`; kunci ini tidak mengunci akses memilih sesi/pilar. Strike ketiga pada ujian menjalankan force-submit.

## Memperbarui Indeks RAG

Jalankan ingest setelah materi Markdown German/English yang dipakai chatbot berubah. Script membaca semua Markdown di `src/modules/german/content/` dan `src/modules/english/content/`, membuat chunk ukuran 500 karakter dengan overlap 50, lalu meminta embedding Cloudflare dan menyimpan baris ke `public.documents`.

1. Pasang dependensi dari root repository:

   ```bash
   python -m pip install -r requirements-rag.txt
   ```

2. Pastikan `.env` mengarah ke project Supabase yang benar dan berisi:
   - `SUPABASE_URL` atau `PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
3. Pastikan schema tabel, index pgvector, dan RPC dari `supabase/setup_rag.sql` telah diterapkan pada project yang dituju.
4. Jalankan re-ingest penuh:

   ```bash
   python scripts/ingest-rag.py --replace-all
   ```

**Perhatian:** `--replace-all` menghapus semua baris `public.documents` sebelum mengisi ulang corpus. Periksa file `.env` dan database target terlebih dahulu, serta pastikan proses embedding dan insert selesai dengan sukses. Ingest bukan bagian dari deploy Vercel.

## Catatan Data dan Pemeliharaan

- `user_progress` menggunakan kunci unik `(user_id, material_slug, language_code)` untuk memisahkan German (`de`) dan English (`en`).
- Leaderboard membaca agregat nama, `profiles.current_level`, dan total XP lewat `public.get_leaderboard()`. Terapkan `supabase/leaderboard.sql` pada project Supabase tujuan; fungsi hanya dapat dieksekusi oleh `service_role`, sedangkan halaman tetap dilindungi middleware autentikasi.
- `sessions_passed` terbaru berupa array key sesi-pilar, misalnya `["s1-reading", "s2-writing"]`. Data lama dinormalisasi saat dibaca.
- Dashboard pencapaian EN/DE menampilkan progres untuk materi yang sudah memiliki XP atau pilar tersimpan. Persentase adalah jumlah pilar unik lulus dibagi empat; batas XP UI diturunkan dari `vocab.length × 4 × 10`, dan sisa XP menjadi nol jika satu sesi lengkap. Ini kalkulasi presentasi, bukan kolom skema baru.
- Kosakata materi tidak lagi menggunakan artikel sebagai entri target. `isArticleQuestion()` menentukan kapan artikel harus dipertahankan: kuis biasa menormalisasi tanpa artikel, sementara soal grammar tertentu mempertahankannya pada grading fuzzy.
- STT memakai browser `noiseSuppression`/`echoCancellation`/`autoGainControl`, band-pass dari high-pass 300 Hz dan low-pass 4 kHz, serta dynamic VAD berdasarkan kalibrasi noise floor. Fallback Web Speech mengikuti locale route (`en-US`/`de-DE`).
- Bookmark, status ujian tertentu, dan hasil sertifikat client-side disimpan di browser.
- File `supabase/user_progress.sql` dapat tertinggal dari schema live; sebelum migrasi, verifikasi schema dan constraint aktual, backup data, lalu uji bertahap.
- Untuk memeriksa sitemap, buka `/sitemap-index.xml` dan `/sitemap-content.xml` pada deployment. Sitemap konten mencakup landing, portal, halaman login, dan koleksi materi German, English Everyday, serta English Academic; rute privat tidak dimasukkan.
- Sebelum menyerahkan perubahan, periksa `git status --short`, `git diff --check`, lalu jalankan `npm run build`.
