# Handover NdUniverse V4

## Status

**V4 Selesai 100% untuk lingkup rilis.** Produk mencakup platform Astro SSR, modul German dan English, latihan bebas pilih sesi/pilar, progress Supabase, chatbot RAG, ujian besar dengan anti-cheat fullscreen, serta audio CDN.

Dokumen ini berisi panduan operasional untuk developer selanjutnya. Jangan mengubah credential di repository atau memasukkan secret ke browser.

## Arsitektur Ringkas

- **Aplikasi:** Astro 7 SSR, Preact, Vercel adapter.
- **Database dan auth:** Supabase PostgreSQL, Auth, Storage, RLS.
- **Chatbot RAG:** materi Markdown dipecah menjadi chunk dan disimpan pada `public.documents`; Cloudflare Workers AI menghasilkan embedding `@cf/baai/bge-small-en-v1.5` (384 dimensi), Supabase `pgvector` melakukan retrieval, dan Groq menulis ulang query/menyusun jawaban.
- **Kuis:** pengguna bebas memilih sesi dan pilar. `sessions_passed` menyimpan key seperti `s1-reading` dan `s2-writing` untuk indikator selesai; key tersebut tidak mengunci akses.
- **Ujian besar:** fullscreen anti-cheat memantau perubahan fullscreen, tab tersembunyi, dan window blur. Strike ketiga memaksa submit; NdBot menampilkan status strike.
- **UI:** seluruh antarmuka menggunakan Bahasa Indonesia hardcoded. Materi dan soal tetap memakai bahasa target.
- **SEO:** sitemap Astro mencantumkan sitemap dinamis materi di `/sitemap-content.xml`; `robots.txt` mengizinkan crawler pada halaman publik.
- **Audio:** manifest dan MP3 TTS utama disajikan dari `nandayudhistirawibowo/nduniverse-audio` melalui jsDelivr.

## Pengembangan Lokal

Persyaratan Node.js `>=22.23.4`.

```bash
npm install
npx astro dev --background
npx astro dev status
npm run build
```

Server background dapat dihentikan dengan `npx astro dev stop` dan log dibaca dengan `npx astro dev logs`.

Isi `.env` lokal sesuai layanan yang digunakan:

```dotenv
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

`SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, dan `CLOUDFLARE_API_TOKEN` adalah secret server-side; jangan pernah memberi prefix `PUBLIC_` atau mengirimkannya ke browser. Script RAG menerima `SUPABASE_URL` atau `PUBLIC_SUPABASE_URL`.

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

Audio yang dibaca aplikasi berada di repo terpisah `nandayudhistirawibowo/nduniverse-audio`, dengan struktur di bawah `audio/`:

- German: `audio/tts/manifest.json` dan MP3 terkait.
- English US: `audio/tts-en-us/manifest-en-us.json` dan MP3 terkait.
- English UK: `audio/tts-en-gb/manifest-en-gb.json` dan MP3 terkait.
- Audio ujian: folder seperti `audio/exam-listening/`.

Alur publikasi:

1. Generate/perbarui MP3 dan manifest lokal. English dapat dibuat dengan `npm run generate:tts:en`; dependensi Python tersedia lewat `python -m pip install -r requirements-tts.txt`.
2. Generator German `npm run generate:tts` saat ini masih membaca sumber legacy `src/content/materi`. Konten German V4 berada di `src/modules/german/content/materi`; jangan menganggap generator German memperbarui semua konten modul sampai path tersebut diselaraskan.
3. Salin aset dan manifest yang akan diterbitkan ke lokasi yang sama di checkout repo audio, misalnya `D:\audio-cdn\audio`. Pertahankan format manifest sebagai mapping teks ke path audio dan pertahankan nama file yang digunakan aplikasi.
4. Commit dan push aset repo audio ke branch `main`:

   ```bash
   git -C D:\audio-cdn status --short
   git -C D:\audio-cdn add audio
   git -C D:\audio-cdn commit -m "Update audio assets"
   git -C D:\audio-cdn push origin main
   ```

5. Setelah MP3 tersedia di repo audio, dari root repository NdUniverse jalankan:

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

Manifest TTS German/English yang dibaca langsung dari repo audio harus ikut dipush bersama MP3. `manifest-cdn.json` adalah peta untuk resolver CDN aplikasi dan disajikan dari branch `main` repository NdUniverse.

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
- `sessions_passed` terbaru berupa array key sesi-pilar, misalnya `["s1-reading", "s2-writing"]`. Data lama dinormalisasi saat dibaca.
- Bookmark, status ujian tertentu, dan hasil sertifikat client-side disimpan di browser.
- File `supabase/user_progress.sql` dapat tertinggal dari schema live; sebelum migrasi, verifikasi schema dan constraint aktual, backup data, lalu uji bertahap.
- Untuk memeriksa sitemap, buka `/sitemap-index.xml` dan `/sitemap-content.xml` pada deployment. Endpoint konten mengambil koleksi materi German, English Everyday, dan English Academic.
- Sebelum menyerahkan perubahan, periksa `git status --short`, `git diff --check`, lalu jalankan `npm run build`.
