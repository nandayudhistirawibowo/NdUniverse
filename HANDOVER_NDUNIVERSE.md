# Handover NdUniverse V4

## Status Sesi

Tanggal handover: 13 November 2026
Nama repository/package: `nandayudhistirawibowo/NdUniverse` / `nduniverse`

## Status V4

**V4 Selesai 100% untuk lingkup rilis.** Cakupan mencakup aplikasi Astro, modul German dan English, progress Supabase, flow kuis empat pilar, pencegahan XP saat Game Over, chatbot RAG, serta metadata SEO dan aset CDN.

Penguncian sesi/pilar kuis saat ini disimpan di `localStorage`; ini menjaga urutan pada browser yang sama tetapi belum tersinkron antarperangkat atau menjadi otorisasi server-side.

Handover ini mendokumentasikan sistem internal. Jangan commit credential atau nilai rahasia.

## Ringkasan Produk

NdUniverse adalah Super App pembelajaran bahasa multi-bahasa berdasarkan Astro 7 SSR.

- `/`: landing page NdUniverse tanpa login.
- `/de`: modul bahasa Jerman, empat pilar CEFR, Goethe, Career, dan Boss Fight.
- `/en`: Everyday dan Academic English, Career, serta persiapan IELTS/TOEFL.
- Seluruh fitur pembelajaran wajib login; akses tanpa login telah dihapus.
- Database progress dipisahkan berdasarkan `language_code` (`de` atau `en`).
- Chatbot RAG mengambil konteks materi Markdown dari Supabase `documents` menggunakan embedding Cloudflare Workers AI dan model Groq.

## Stack dan Aturan Keras

- Astro 7 SSR dengan adapter Vercel.
- Preact dan JSX untuk komponen interaktif.
- Supabase Auth, PostgreSQL, dan RLS.
- Supabase `pgvector` untuk indeks dokumen RAG; Cloudflare Workers AI menghasilkan embedding 384 dimensi.
- Groq menangani query rewriting dan jawaban chatbot; jsDelivr menyajikan aset audio/manifest yang diarahkan ke CDN.
- CSS murni dengan CSS variables dan media queries.
- Tidak boleh menggunakan Tailwind.
- Simbol nama komponen bahasa dipisahkan dengan suffix `-de` dan `-en`.
- Progress lama tetap kompatibel, termasuk `sessions_passed` berupa angka `[1, 2, 3, 4]` maupun nama pilar baru.
- XP anti-farming: XP sementara hangus saat Game Over.
- Jangan commit `.env`, service role key, atau credential lain.
- Pastikan seluruh tampilan responsif pada desktop dan mobile.

## Kondisi Implementasi Saat Ini

Status proyek V4: **SELESAI 100% untuk lingkup rilis**. Materi dan route German serta English, progress, chatbot RAG, kuis, ujian, dan fitur platform termasuk dalam implementasi V4.

## Validasi Performa

- Load testing dengan k6 telah dilakukan dan hasilnya sangat baik: 100 Virtual Users selama 60 detik, 5.797 request, 100.00% success rate (0% error), rata-rata respons 32.07 ms, p(95) 44.7 ms, dan sekitar 95.31 req/s.
- Skor PageSpeed: **100/100/100/100**.
- Laporan lengkap tersedia di [TESTING.md](TESTING.md).

## Pencapaian V4

- Modul German lengkap dan dinyatakan 100% selesai.
- Kuis 4 Pilar CEFR, Ujian Goethe, Career, dan Boss Fight tersedia.
- TTS 2 tombol untuk kata dan kalimat tersedia.
- Mobile responsive dengan touch target minimal 44px.
- Dashboard, Bookmark, progress, XP, materi A1-C2, dan sertifikat tersedia.
- Chatbot RAG melakukan query rewrite, retrieval konteks, dan jawaban tutor.
- Kuis memiliki urutan empat pilar per sesi dan tombol Next mengikuti urutan pilar.
- Akses tanpa login dihapus; pengguna harus login sebelum mengakses dashboard atau pembelajaran.

### Konfigurasi tetap tersedia

- Landing page platform dan routing `/de` serta `/en`.
- Komponen English berada di `src/modules/english/components/`, termasuk `EnglishExam-en.jsx`, `Quiz-en.jsx`, `IELTSExam-en.jsx`, `MockExam-en.jsx`, `CareerQuiz-en.jsx`, dan `BossFight-en.jsx`.
- Konten English berada di `src/modules/english/content/`, dengan collection `englishEveryday` dan `englishExam`.
- Config speech English tersedia di `src/modules/english/config/english-speech.js`.
- Komponen English untuk kuis, IELTS, Career, dan Boss Fight.
- Client progress terpisah: `src/core/db/progress-client.js` dan `src/core/db/progress-client-en.js`.
- Client English mengirim `language_code: 'en'` dan menggunakan upsert `user_id, material_slug, language_code`.
- Migrasi kolom `language_code` sudah dijalankan di Supabase. File `supabase/user_progress.sql` di repository belum sinkron dan perlu disesuaikan sebelum digunakan sebagai sumber migrasi berikutnya.
- Pembagian komponen/asset German dan platform ke struktur modular.
- Generator TTS German dan English tersedia; audio/manifest yang diarahkan ke CDN diambil dari jsDelivr.

Catatan operasional di luar status rilis:

- Perubahan konten Markdown tidak otomatis memperbarui indeks chatbot; jalankan ingest RAG penuh setelah perubahan materi yang ingin dicari oleh chatbot.
- Penguncian sesi kuis berada di localStorage sehingga tidak otomatis berpindah browser/perangkat.
- Pastikan environment variables Vercel dan lokal terisi pada environment yang sesuai; jangan menaruh service role key pada variabel `PUBLIC_*`.

## Deploy dan Memperbarui Indeks RAG

### Deploy aplikasi

1. Pastikan project Vercel terhubung ke repository dan production branch yang benar.
2. Set environment variables server-side di Vercel: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, dan `CLOUDFLARE_API_TOKEN`.
3. Jalankan `npm run build` secara lokal untuk memverifikasi perubahan, lalu push ke branch deployment agar Vercel menjalankan build dan deploy.
4. Jangan mengekspos `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, atau `CLOUDFLARE_API_TOKEN` ke browser maupun variabel `PUBLIC_*`.

### Re-ingest setelah materi berubah

Script `scripts/ingest-rag.py` membaca seluruh file Markdown di `src/modules/german/content/` dan `src/modules/english/content/`, membuat chunk ukuran 500 karakter dengan overlap 50, lalu menyimpan embedding 384 dimensi ke Supabase.

1. Siapkan Python dan pasang dependensi dari root repository:

   ```bash
   python -m pip install -r requirements-rag.txt
   ```

2. Isi `.env` lokal dengan `SUPABASE_URL` (atau `PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_ACCOUNT_ID`, dan `CLOUDFLARE_API_TOKEN`.
3. Pastikan schema dan RPC dari `supabase/setup_rag.sql` sudah diterapkan pada project Supabase yang benar.
4. Jalankan ingest penuh dengan perintah eksplisit:

   ```bash
   python scripts/ingest-rag.py --replace-all
   ```

**Peringatan:** ingest saat ini menghapus semua baris di `public.documents`, lalu mengisi ulang seluruh corpus. Jalankan hanya setelah memastikan kredensial menunjuk ke database yang benar dan proses embedding berhasil disiapkan. Script tidak dijalankan sebagai bagian dari deploy Vercel.

## Temuan Database Penting

Migrasi untuk kolom `language_code` sudah dijalankan di Supabase. File `supabase/user_progress.sql` masih perlu disesuaikan dengan schema tersebut; jangan jalankan ulang migrasi berdasarkan file lama sebelum memeriksa constraint dan kondisi database aktual.

Target schema yang direncanakan:

```sql
alter table public.user_progress
  add column if not exists language_code varchar not null default 'de';

alter table public.user_progress
  drop constraint if exists user_progress_user_id_material_slug_key;

alter table public.user_progress
  add constraint user_progress_user_material_language_key
  unique (user_id, material_slug, language_code);
```

Sebelum migration:

1. Cadangkan database Supabase dan ekspor constraint/unique index yang ada.
2. Verifikasi nama constraint aktual pada environment Supabase.
3. Normalisasi baris lama menjadi `language_code = 'de'`.
4. Lakukan migration staged dan verifikasi di staging.
5. Jangan menghapus data lama saat memindahkan atau menambahkan language code.

`src/core/db/progress-client.js` juga harus mempertahankan pemulihan angka lama dan nama pilar baru tanpa menghapus format lama saat menyimpan kembali.

## Catatan Pemeliharaan

### Verifikasi Migrasi Progress Sebelum Penggunaan Ulang

- Sesuaikan `supabase/user_progress.sql` dengan migrasi `language_code` yang sudah diterapkan di Supabase.
- Verifikasi unique key `(user_id, material_slug, language_code)` dan default `'de'` terhadap schema aktual.
- Jangan menjalankan ulang migrasi secara buta; lakukan perubahan staged setelah backup dan verifikasi.

## Peraturan Konten German

- Setiap file materi German wajib mempunyai tepat 20 vocab, kecuali Career yang memiliki format khusus 50 vocab.
- Field `german`, `indonesian`, `context`, dan `contextIndonesian` wajib konsisten.
- `context` harus pendek dan natural.
- Schema saat ini mempunyai `contextIndonesian` sebagai field optional, tetapi konten baru harus mengisinya.
- `sessions_passed` tetap mendukung format lama dan format pilar CEFR.

## Perintah Lokal

```bash
npm install
npm run build
npx astro dev --background
npx astro dev status
npx astro dev logs
npx astro dev stop
```

Untuk generator German saat ini:

```bash
python -m pip install -r requirements-tts.txt
npm run generate:tts
```

Generator German saat ini perlu disesuaikan setelah refactor path German ke `src/modules/german/content/materi`.

## Environment Variables

Tetapkan hanya nilai yang diperlukan pada environment lokal, deployment Vercel, dan preview environment:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`, hanya untuk proses server yang benar-benar membutuhkan service role
- `GROQ_API_KEY`, untuk query rewriting dan jawaban chatbot server-side
- `CLOUDFLARE_ACCOUNT_ID` dan `CLOUDFLARE_API_TOKEN`, untuk embedding chatbot dan proses ingest RAG

Jangan menaruh service role key, Groq API key, atau Cloudflare API token pada variabel `PUBLIC_*`. Jangan commit environment file.

## Catatan Git

Workspace memiliki banyak perubahan/refactor yang sudah diregistrasi, termasuk pemindahan banyak file. Hati-hati saat menyelesaikan perubahan agar tidak melakukan `reset`, `checkout`, atau overwrite terhadap perubahan pengguna.

Gunakan pemeriksaan berikut sebelum commit:

```bash
git status --short
git diff --stat
npm run build
```
