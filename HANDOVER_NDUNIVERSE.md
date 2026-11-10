# Handover NdUniverse

## Status Sesi

Tanggal handover: 8 November 2026  
Nama repositori Git lokal/package saat pemeriksaan: `sideutsch`  
Nama produk/responsitori yang dituju: `NdUniverse`

Dokumen ini bersifat internal dan harus tetap diabaikan Git. Jangan commit file ini atau credential apa pun.

## Ringkasan Produk

NdUniverse adalah Super App pembelajaran bahasa multi-bahasa berdasarkan Astro 7 SSR.

- `/`: landing page NdUniverse tanpa login.
- `/de`: modul bahasa Jerman, empat pilar CEFR, Goethe, Career, dan Boss Fight.
- `/en`: fondasi Modul English selesai, mencakup Everyday English dan Exam Prep IELTS/TOEFL.
- Seluruh fitur pembelajaran wajib login; akses tanpa login telah dihapus.
- Database progress dipisahkan berdasarkan `language_code` (`de` atau `en`).
- Repository saat ini masih bernama `sideutsch` secara lokal/package; penggantian nama GitHub dapat dilakukan dari Settings repository.

## Stack dan Aturan Keras

- Astro 7 SSR dengan adapter Vercel.
- Preact dan JSX untuk komponen interaktif.
- Supabase Auth, PostgreSQL, dan RLS.
- CSS murni dengan CSS variables dan media queries.
- Tidak boleh menggunakan Tailwind.
- Simbol nama komponen bahasa dipisahkan dengan suffix `-de` dan `-en`.
- Progress lama tetap kompatibel, termasuk `sessions_passed` berupa angka `[1, 2, 3, 4]` maupun nama pilar baru.
- XP anti-farming: XP sementara hangus saat Game Over.
- Jangan commit `.env`, service role key, atau credential lain.
- Pastikan seluruh tampilan responsif pada desktop dan mobile.

## Kondisi Implementasi Saat Ini

Status finalisasi fase German: **SELESAI 100% untuk lingkup saat ini**.  
Status modul English: **Fondasi UI & Routing Selesai**. Route Everyday English dan Exam Prep tersedia; pengisian konten skala penuh dan TTS menyusul.

## Validasi Performa

- Load testing dengan k6 telah dilakukan dan hasilnya sangat baik: 100 Virtual Users selama 60 detik, 5.797 request, 100.00% success rate (0% error), rata-rata respons 32.07 ms, p(95) 44.7 ms, dan sekitar 95.31 req/s.
- Skor PageSpeed: **100/100/100/100**.
- Laporan lengkap tersedia di [TESTING.md](TESTING.md).

## Pencapaian Fase 1

- Modul German lengkap dan dinyatakan 100% selesai.
- Kuis 4 Pilar CEFR, Ujian Goethe, Career, dan Boss Fight tersedia.
- TTS 2 tombol untuk kata dan kalimat tersedia.
- Mobile responsive dengan touch target minimal 44px.
- Dashboard, Bookmark, progress, XP, materi A1-C2, dan sertifikat tersedia.
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
- Generator TTS German yang membaca koleksi materi German dari `src/content/materi` saat ini sudah tidak lagi sesuai struktur aktual dan perlu diperiksa/diperbarui ke `src/modules/german/content/materi`.

Belum tersedia atau belum terverifikasi:

- Konten Everyday English dan bank soal IELTS/TOEFL skala penuh belum diisi; contoh A1 tersedia di `src/modules/english/content/everyday/` dan `src/modules/english/content/exam/`.
- Schema collections `englishEveryday` dan `englishExam` sudah terdaftar di `src/content.config.ts`.
- Audio English produksi dan manifest belum tersedia; TTS/browser fallback sudah disiapkan.
- Penyimpanan progress `language_code = 'en'` ke Supabase masih perlu diuji end-to-end.
- Generator TTS masih khusus German dan belum mendukung mode/target language English.
- Nama repositori GitHub lama perlu diselaraskan manual dengan nama produk `NdUniverse`.

## Sisa Pekerjaan

1. **Fase 2.5: Isi Konten Inggris (Materi & TTS)** menjadi langkah berikutnya.
2. Isi materi Everyday English A1-C2 dan bank soal IELTS/TOEFL secara bertahap.
3. Kembangkan generator, aset audio, dan manifest TTS English.
4. Uji simpan/muat progress `language_code = 'en'` secara end-to-end.
5. Sinkronkan file `supabase/user_progress.sql` dengan migrasi yang sudah dijalankan di Supabase setelah memverifikasi schema aktual.

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

## Backlog Prioritas

### 1. Sinkronkan File Migrasi Progress

- Sesuaikan `supabase/user_progress.sql` dengan migrasi `language_code` yang sudah diterapkan di Supabase.
- Verifikasi unique key `(user_id, material_slug, language_code)` dan default `'de'` terhadap schema aktual.
- Jangan menjalankan ulang migrasi secara buta; lakukan perubahan staged setelah backup dan verifikasi.

### 2. Isi Materi English

- Tambahkan materi Everyday English ke `src/modules/english/content/everyday/`.
- Tambahkan bank soal IELTS/TOEFL ke `src/modules/english/content/exam/`.
- Gunakan schema collections `englishEveryday` dan `englishExam` yang sudah terdaftar.

### 3. Produksi TTS English

- Modifikasi atau buat generator terpisah untuk `src/modules/english/content/`.
- Gunakan Edge TTS voice English `en-US` atau `en-GB`.
- Simpan MP3 di `public/audio/tts-en/` dan buat manifest English.
- Jangan mengubah manifest German tanpa kebutuhan eksplisit.

Contoh dependensi Python saat ini tersedia melalui `requirements-tts.txt`.

### 4. Jalankan E2E Modul English

Uji:

- Login dan navigasi `/en` pada desktop serta mobile.
- Kuis English berhasil menyelesaikan pilar yang diharapkan.
- Progress tersimpan dengan `language_code = 'en'`.
- Progress German dan English tidak bercampur pada slug yang sama.
- `sessions_passed` lama masih terbaca.
- XP tidak diberikan saat percobaan yang kalah atau farming berulang.

### 5. Perbarui Dokumentasi Publik

- `README.md`.
- `PRD_NDUNIVERSE.md`.
- `ERD.md`.
- `FLOWCHART.md`.

### 6. Rename Repository GitHub

Lakukan manual di GitHub:

1. Masuk Settings repository.
2. Ubah nama dari `sideutsch` menjadi `NdUniverse`.
3. Perbarui remote URL lokal jika GitHub tidak melakukan redirect otomatis.
4. Pastikan deployment Vercel dan custom domain tetap terhubung.

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

Jangan menaruh service role key pada variabel `PUBLIC_*`. Jangan commit environment file.

## Catatan Git

Workspace memiliki banyak perubahan/refactor yang sudah diregistrasi, termasuk pemindahan banyak file. Hati-hati saat menyelesaikan perubahan agar tidak melakukan `reset`, `checkout`, atau overwrite terhadap perubahan pengguna.

Gunakan pemeriksaan berikut sebelum commit:

```bash
git status --short
git diff --stat
npm run build
```
