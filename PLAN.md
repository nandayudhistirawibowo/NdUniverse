# NdUniverse Development Plan

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

Status: **BERIKUTNYA**

- Isi materi Everyday English bertahap untuk level A1-C2.
- Kembangkan bank soal Reading, Listening, Writing, dan Speaking untuk IELTS/TOEFL.
- Produksi audio/TTS English dan manifest dengan voice `en-US` atau `en-GB`.
- Uji konten, audio, dan alur belajar English end-to-end.

## Fase 3 — Backend dan RLS

Status: **BELUM DIMULAI**

- Audit kebijakan akses data dan row-level security.
- Finalisasi kebutuhan backend multi-bahasa.

## Fase 4 — Validasi dan Rilis

- **Fase 1 (Modul German & Fondasi Platform): SELESAI**
- **Fase 2 (Modul Inggris - Fondasi): SELESAI**
- **Fase 2.5 (Konten Inggris & TTS): BERIKUTNYA**
- **Fase 3 (Backend/RLS): BELUM DIMULAI**
- Uji regresi dan kesiapan rilis dilaksanakan setelah konten fase 2.5 tersedia.
