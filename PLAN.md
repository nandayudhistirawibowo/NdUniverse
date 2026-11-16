# NdUniverse Development Plan

## Status V4

Dokumen ini memisahkan kemampuan yang sudah tampak pada source saat ini dari ide/backlog yang belum diimplementasikan. Status source bukan sertifikasi release atau konfirmasi bahwa migrasi backend telah diterapkan di production.

## Fase 1 — Modul German dan Fondasi Platform

Status: **SELESAI**

- Landing dan navigasi NdUniverse.
- Modul German `/de`.
- Materi Alltagsdeutsch dan Fachdeutsch A1-C2.
- Kuis empat pilar.
- Dashboard, progress, XP, bookmark, TTS, dan SFX.

## Fase 2 — Modul Inggris (Fondasi)

Status: **SELESAI**

- Struktur `src/modules/english/` simetris dengan modul German.
- Content Collections `englishEveryday`, `englishAcademic`, `englishCareer`, dan `englishExam` beserta schema IELTS/TOEFL.
- Route Everyday English, Exam Prep IELTS/TOEFL, dan redirect kompatibilitas route IELTS lama.
- UI katalog, login, kuis, komponen ujian, dan contoh soal A1.

## Fase 2.5 — Isi Konten Inggris (Materi & TTS)

Status: **IMPLEMENTASI TERSEDIA; ekspansi konten dan aset audio berlanjut**

#### Backlog ekspansi pasca-V4

- Lanjutkan penambahan materi Everyday English A1-C2 dan bank soal IELTS/TOEFL sesuai kebutuhan produk.
- Perluas produksi audio English dengan generator dua aksen `en-US` dan `en-GB`; validasi aset dan manifest setelah publikasi.
- Jalankan regresi konten, audio, dan alur belajar English setelah perubahan besar.

## Backlog Pasca-V4 — Perbaikan Kualitas Speaking & STT

Status: **SEBAGIAN SUDAH DIIMPLEMENTASIKAN; sisanya usulan**

- Speaking saat ini mendukung input teks dan Speech Recognition; menjadikan suara satu-satunya cara menjawab masih merupakan keputusan produk yang belum diterapkan.
- Locale Speech Recognition sudah mengikuti bahasa: German `de-DE`, English `en-US`.
- Fuzzy matching sudah tersedia di `src/core/game/fuzzy-match.js` dan digunakan pada latihan serta beberapa ujian. Tinjau hasil grading untuk memastikan ambang cocok dengan tiap jenis jawaban sebelum mengubahnya.

## Fase 2.6 — Standarisasi Grading Ujian

Status: **UTILITAS BERSAMA SUDAH DIIMPLEMENTASIKAN**

`src/core/game/exam-grading.js` dipakai oleh ujian English dan Goethe untuk menghitung skor modul, memeriksa kelulusan, serta membaca/menyimpan hasil di `localStorage`. English juga menggunakan helper skor TOEFL/IELTS dan estimasi band. Helper mempertahankan pembacaan key lama untuk kompatibilitas. Perubahan lanjutan harus mengikuti test dan implementasi aktif, bukan daftar fungsi rencana terdahulu.

## Backlog Pasca-V4 — Audit Backend dan RLS

Status: **PERLU VERIFIKASI BERKALA**

- SQL untuk `user_progress` menetapkan RLS berbasis pemilik dan unique key berdasarkan bahasa; kebijakan bucket avatar juga tersedia di `supabase/`.
- Verifikasi penerapan dan konfigurasi pada project Supabase target sebelum rilis. File SQL repository saja tidak membuktikan schema live sudah sama.

## Fase 3.5 — Eksperimen SSML (Suara Manusiawi)

Status: **BACKLOG PASCA-V4**

- Riset penggunaan SSML (Speech Synthesis Markup Language) pada Edge TTS.
- Buat 10 contoh kalimat menggunakan tag `<break>`, `<prosody>`, dan `<emphasis>`.
- Jika hasilnya bagus dan terdengar natural, tentukan cakupan penerapan berdasarkan kebutuhan dan kapasitas aset; jangan mengasumsikan jumlah file tertentu.

## Fase 4 — Validasi dan Rilis

- Jalankan build dan tes yang relevan untuk setiap perubahan. Panduan perintah ada di `TESTING.md`.
- Status deploy dan hasil uji production perlu dicatat terpisah; dokumen ini tidak menyatakan keduanya sudah tervalidasi.

## Backlog Pasca-V4 — AI Advanced (Whisper & LLM)

Status: **BACKLOG PASCA-V4**

- Riset integrasi Whisper API untuk Pronunciation Assessment dengan nilai 0-100.
- Riset integrasi LLM untuk Grammar Correction pada Writing dan Speaking.
