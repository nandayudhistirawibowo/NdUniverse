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

- Generator TTS umum mencakup materi, kuis, ujian, karier, Grammar, dan Pronunciation EN/DE. Audit dry-run memeriksa file lokal, tidak meminta status CDN lewat HTTP/HEAD.
- Dashboard English dan German membaca XP dari `user_progress.xp`, mencapnya pada 800, dan menampilkan persentase `Math.round((currentXp / 800) * 100)` serta `currentXp / 800 XP`; pada 800 bar selalu 100% penuh. Standar materi adalah 4 sesi × 5 kosakata, 10 XP per kosakata per pilar, 50 XP per pilar, 200 XP per sesi, dan maksimal 800 XP. Bar pilar tetap biner 100%/0%. Data Alltagsdeutsch dan Everyday English memiliki 20 kata per materi; beberapa Academic English masih 17–19.
- Pengulangan sesi yang seluruh empat pilarnya telah selesai tidak menghasilkan XP tambahan. Runtime/UI mencap XP 800; migration `supabase/cap_user_progress_xp.sql` hanya cleanup data lama satu kali, bukan CHECK maksimum database.
- Entri artikel telah dihapus dari daftar kosakata materi; `isArticleQuestion` mempertahankan artikel hanya pada prompt yang memang mengujinya.

#### Backlog ekspansi pasca-V4

- Lanjutkan penambahan materi Everyday English A1-C2 dan bank soal IELTS/TOEFL sesuai kebutuhan produk.
- Perluas produksi audio English dengan generator dua aksen `en-US` dan `en-GB`; validasi aset dan manifest setelah publikasi.
- Jalankan regresi konten, audio, dan alur belajar English setelah perubahan besar.

## Backlog Pasca-V4 — Perbaikan Kualitas Speaking & STT

Status: **PIPELINE STT SUDAH DIIMPLEMENTASIKAN; penyempurnaan produk tetap backlog**

- Capture memakai Groq Whisper, fallback Speechmatics Batch API dan Web Speech API; matching alternatif mendukung exact, phonetic, dan fuzzy.
- Rekaman menerapkan noise suppression browser, band-pass high-pass 80 Hz/low-pass 8 kHz, pre-roll 1.500 ms sebelum VAD aktif, dan hangover dinamis 800 ms untuk kata tunggal atau 2.000 ms untuk kalimat.
- Locale Speech Recognition mengikuti bahasa: German `de-DE`, English `en-US`. Speaking tetap mendukung input teks; menjadikan suara satu-satunya cara menjawab masih merupakan keputusan produk yang belum diterapkan.
- Fuzzy matching sudah tersedia di `src/core/game/fuzzy-match.js` dan digunakan pada latihan serta beberapa ujian. Tinjau hasil grading untuk memastikan ambang cocok dengan tiap jenis jawaban sebelum mengubahnya.

## Fitur Leaderboard

Status: **UI DAN RPC SUDAH DIIMPLEMENTASIKAN; penerapan database perlu diverifikasi per project**

- Halaman EN/DE menyajikan podium Top 3 dan peringkat hingga Top 100, urut level menurun lalu XP menurun.
- RPC mengecualikan nama/NIM yang mengandung `admin` dan total XP 0; `Leaderboard.astro` berlangganan Realtime `postgres_changes` pada progress/profil. SQL memberi grant execute `anon`, `authenticated`, `service_role`, sementara aplikasi memanggilnya server-side dengan service-role client.
- Terapkan `supabase/leaderboard.sql` setelah schema progress dan `profiles.current_level` tersedia. Keberadaan migration di repository bukan bukti bahwa database deployment telah diperbarui.

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
