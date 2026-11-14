# NdUniverse Development Plan

## Status V4

**V4 selesai 100% untuk lingkup rilis.** Item riset/peningkatan yang belum menjadi bagian dari lingkup rilis dicatat sebagai backlog pasca-V4 di bawah.

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
- Content Collections `englishEveryday` dan `englishExam` beserta schema IELTS/TOEFL.
- Route Everyday English, Exam Prep IELTS/TOEFL, dan redirect kompatibilitas route IELTS lama.
- UI katalog, login, kuis, komponen ujian, dan contoh soal A1.

## Fase 2.5 — Isi Konten Inggris (Materi & TTS)

Status: **TERCAKUP V4; generator dual-accent tersedia, ekspansi konten/aset audio menjadi backlog pasca-V4**

#### Backlog ekspansi pasca-V4

- Lanjutkan penambahan materi Everyday English A1-C2 dan bank soal IELTS/TOEFL.
- Perluas produksi audio English dengan generator dua aksen `en-US` dan `en-GB`.
- Lanjutkan audit kelengkapan hingga target 13.385 file audio, termasuk pemeriksaan file corrupt/0KB.
- Jalankan regresi konten, audio, dan alur belajar English end-to-end setelah perubahan besar.

## Backlog Pasca-V4 — Perbaikan Kualitas Speaking & STT

Status: **BACKLOG PASCA-V4**

- Tutup bolong Speaking: hapus input teks (text box) di mode Speaking. Verifikasi jawaban hanya berdasarkan hasil STT (Web Speech API); user wajib ngomong.
- Benerin bahasa STT secara dinamis: jika materi Jerman, gunakan `recognition.lang = "de-DE"`; jika materi Inggris, gunakan `recognition.lang = "en-US"`.
- Tambahkan fuzzy matching, misalnya Levenshtein distance, agar typo kecil dari STT (misalnya "I'm board" untuk target "I'm bored") tetap dianggap benar.

## Fase 2.6 — Standarisasi Grading Ujian (Goethe, IELTS, TOEFL)

Status: **BACKLOG PASCA-V4**

### Utility Grading Bersama

Rencanakan utility bersama di `src/core/game/exam-grading.js` dengan fungsi:

- `calculateModuleScore(correct, total, type)` — hitung skor 0-100 per modul.
- `isPassed(moduleScores, threshold=60)` — cek semua modul mencapai ambang kelulusan 60%.
- `getStorageKey(examType, level)` — kembalikan key unik berdasarkan tipe ujian dan level.
- `saveExamResult(examType, level, result)` dan `getExamResult(examType, level)` — simpan dan baca hasil dari localStorage.
- `getBandScore(percentage)` — gunakan mapping statis persentase ke Band Score IELTS/TOEFL.

### Storage Key Terpisah

- Goethe: `nduniverse-goethe-[level]`
- IELTS: `nduniverse-exam-ielts-[level]`
- TOEFL: `nduniverse-exam-toefl-[level]`

### Band Score Mapping (Statis)

Jangan menghitung atau mengubah mapping ini secara dinamis:

| Persentase | Estimasi Band Score |
|---|---|
| 90-100% | Band 8.0 - 9.0 |
| 80-89.9% | Band 7.0 - 7.5 |
| 70-79.9% | Band 6.0 - 6.5 |
| 60-69.9% | Band 5.5 - 6.0 |
| 0-59.9% | Di Bawah 5.5 |

### Komponen yang Perlu Diupdate

- `GoetheExam-de.jsx` — gunakan utility grading bersama.
- `EnglishExam-en.jsx` — gunakan utility bersama dan tampilkan Band Score.
- `src/pages/en/exam/[type]/[level].astro` — tampilkan Band Score Estimate di halaman hasil.

### Catatan

- Band Score hanya estimasi dan bukan sertifikat resmi.
- Jangan hapus data localStorage lama; implementasi harus backward-compatible.
- Jangan ubah timer atau UI yang sudah berjalan.

## Backlog Pasca-V4 — Audit Backend dan RLS

Status: **BACKLOG PASCA-V4**

- Audit kebijakan akses data dan row-level security.
- Finalisasi kebutuhan backend multi-bahasa.

## Fase 3.5 — Eksperimen SSML (Suara Manusiawi)

Status: **BACKLOG PASCA-V4**

- Riset penggunaan SSML (Speech Synthesis Markup Language) pada Edge TTS.
- Buat 10 contoh kalimat menggunakan tag `<break>`, `<prosody>`, dan `<emphasis>`.
- Jika hasilnya bagus dan terdengar tidak robotik, terapkan ke semua 13.385 file generate TTS.

## Status Fase 4 — Validasi dan Rilis

- Lingkup rilis V4 telah selesai; item lanjutan di bawah tidak memblokir status V4.

## Backlog Pasca-V4 — AI Advanced (Whisper & LLM)

Status: **BACKLOG PASCA-V4**

- Riset integrasi Whisper API untuk Pronunciation Assessment dengan nilai 0-100.
- Riset integrasi LLM untuk Grammar Correction pada Writing dan Speaking.
