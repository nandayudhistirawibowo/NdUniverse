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
- `/en`: modul bahasa Inggris ditunda; halaman login menampilkan status Under Development.
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
Status modul English: **DITUNDA / Under Development**. `/login-en` menampilkan pesan penundaan; Auth dan form lama dipertahankan tersembunyi untuk pengaktifan berikutnya.

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
- Komponen English untuk kuis, IELTS, Career, dan Boss Fight.
- Client progress terpisah: `src/core/db/progress-client.js` dan `src/core/db/progress-client-en.js`.
- Client English mengirim `language_code: 'en'` dan menggunakan upsert `user_id, material_slug, language_code`.
- Pembagian komponen/asset German dan platform ke struktur modular.
- Generator TTS German yang membaca koleksi materi German dari `src/content/materi` saat ini sudah tidak lagi sesuai struktur aktual dan perlu diperiksa/diperbarui ke `src/modules/german/content/materi`.

Belum tersedia atau belum terverifikasi:

- Koleksi Markdown English di `src/content/en/` belum ada.
- Schema English belum didaftarkan di `src/content.config.ts`.
- Audio English dan folder `public/audio/tts-en/` belum ada.
- Pengujian E2E `/en` dan penyimpanan `language_code = 'en'` di Supabase belum terverifikasi.
- Generator TTS masih khusus German dan belum mendukung mode/target language English.
- Migrasi SQL repository belum mencerminkan perubahan multi-language. `supabase/user_progress.sql` masih memakai unique lama `(user_id, material_slug)` dan belum membuat `language_code`.
- Nama repositori GitHub lama perlu diselaraskan manual dengan nama produk `NdUniverse`.

## Sisa Pekerjaan Fase 2-5

1. **Fase 2: Modul English** ditunda, termasuk materi dan dashboard aktif.
2. **Fase 3: Backend/Testing** ditunda untuk pengujian dan validasi end-to-end.
3. **Fase 4: IELTS/TOEFL dan English Career** ditunda.
4. **Fase 5: Finalisasi publikasi, deployment, dan dokumentasi** menunggu modul aktif berikutnya.

## Temuan Database Penting

Jangan menjalankan `upsert` English sampai schema Supabase dan repository migration konsisten.

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

### 1. Selesaikan Migration Database English

- Tambahkan atau perbaiki `language_code` pada `user_progress`.
- Ganti unique lama dengan `(user_id, material_slug, language_code)`.
- Sinkronkan constraint Supabase SQL dengan implementasi di kode.
- Tambahkan default `'de'` untuk backward compatibility.

### 2. Buat Materi English

- Buat `src/content/en/` beserta koleksi Astro.
- Tentukan schema khusus untuk `title`, `description`, `level`, `track`, dan vocabulary.
- Tambahkan minimal satu materi English yang dapat dipakai untuk menguji kuis `/en`.
- Sambungkan halaman dan komponen quiz ke loader materi English tersebut.

### 3. Buat TTS English

- Modifikasi atau buat generator terpisah untuk `src/content/en/`.
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
