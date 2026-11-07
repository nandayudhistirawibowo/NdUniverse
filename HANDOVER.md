# Handover siDeutsch

## Ringkasan Project Terbaru

siDeutsch adalah platform belajar bahasa Jerman A1–C2 berbasis Astro 7 dan Preact 11. Sistem terbaru memadukan empat pilar CEFR, materi Alltagsdeutsch dan Fachdeutsch, simulasi ujian, Career, Boss Fight Visual Novel, progress Supabase, dan sertifikat PDF.

## Struktur Folder Kunci

### Core Application

- `src/pages/`: routing Astro untuk dashboard, materi, ujian, sertifikat, dan Career.
- `src/components/`: komponen Preact interaktif seperti Quiz, GoetheExam, MockExam, CareerQuiz, dan BossFight.
- `src/layouts/`: layout guest, dashboard, dan admin.
- `src/content.config.ts`: definisi schema Content Collections.
- `src/lib/`: helper autentikasi, progress, TTS, dan utilitas aplikasi.
- `supabase/user_progress.sql`: skema dan kebijakan data progress.

### Content Collections

- `src/content/materi/`: materi Alltagsdeutsch dan Fachdeutsch dalam Markdown.
- `src/content/career/*.md`: empat rumpun profesi Career.
- `public/audio/tts/`: MP3 pengucapan dan manifest TTS.

Setiap materi Career berisi tepat 50 entri `vocab` dan 10 entri `boss_questions` dengan keywords. Konten Career tidak disimpan di Supabase.

## Perbaikan dan Fitur yang Selesai

### [C] Feedback via WhatsApp

- Tombol **Kirim Feedback** tersedia pada navbar guest dan dashboard.
- Modal responsif menyediakan kategori `Bug`, `Saran Fitur`, dan `Lainnya`.
- Pesan dikirim ke WhatsApp Admin `081288951254` melalui URL WhatsApp dengan kategori, pesan, dan URL halaman saat ini.
- Modal mendukung tombol Batal, backdrop, Escape, scroll lock, dan layout aman untuk layar kecil.

### [C] Responsive UI Mobile & Desktop

- Layout Career memakai grid responsif: satu kolom di HP, dua kolom pada tablet, dan empat kolom pada desktop lebar.
- Navbar Guest dan Dashboard tetap dapat digunakan pada layar kecil; Dashboard memiliki sidebar hamburger, sedangkan identitas akun dipadatkan bila ruang terbatas.
- Modal Feedback memakai `100dvh`, max-width, padding aman, tombol full-width di mobile, dan penyesuaian orientation/height kecil.
- Boss Fight memiliki wrapping teks, chat scroll terbatas, ruangan intro, tombol aksi, dan textarea yang tidak meluber pada layar HP.
- Halaman Mini-Mock dan Goethe memakai satu kolom pilihan serta modul hasil yang bertumpuk pada layar kecil.

### [C] Ujian A1–C2

- Mini-Mock Exam dipisahkan sebagai `/ujian/[level]` dengan komposisi 22 soal.
- Simulasi Goethe berada di `/ujian/goethe/[level]` dan memiliki Lesen, Hören, Schreiben, dan Sprechen.
- Skor esai memakai penilaian persentase parsial berdasarkan kata kunci, bukan benar/salah penuh.
- Kelulusan Goethe mensyaratkan minimal 60% pada setiap modul.
- Feedback hasil menampilkan jawaban user dan kata kunci yang dinilai.
- Route hasil memperbaiki link ke `/dashboard/alltags/[level]` dengan normalisasi level case-insensitive.

### [C] Sertifikat PDF

- Halaman sertifikat Mini-Mock dan Goethe memiliki elemen unik `certificate`.
- `html2pdf.js` dipanggil sebagai import client-side ter-bundle dan memiliki konfigurasi A4 landscape.
- Status kelulusan divalidasi dari localStorage sebelum akses sertifikat.
- Navigasi kelulusan Goethe dan Mini-Mock mengarah ke Dashboard.

### [C] Career dan Boss Fight

- `/career` menampilkan empat card profesi: IT, Business, Health, dan Nutrition.
- Badge Coming Soon pada menu Career sudah dihapus.
- Halaman materi memiliki kuis kosakata.
- Boss Fight dipisahkan ke route `/career/[profesi]/boss`.
- Boss Fight memiliki state `intro -> interview -> finished`.
- Intro memakai ruangan CSS, animasi pintu, Boss, dan dialog Visual Novel.
- Interview memiliki sepuluh pertanyaan bertahap, text box, Mic/Speech Recognition, dan penilaian keywords.
- Empat file Career masing-masing berisi 50 vocab dan 10 pertanyaan wawancara.

### [C] Progress dan TTS

- `sessions_passed` mendukung nama pilar baru dan format lama `[1,2,3,4]`.
- Materi dinyatakan lulus setelah keempat pilar selesai.
- XP dan anti-farming tetap dipertahankan.
- TTS memakai manifest MP3 statis dengan fallback Web Speech API `de-DE`.

## Checklist Sisa Pekerjaan

- [x] Implementasi UI Animasi Ruangan & Pintu di Boss Fight.
- [x] Implementasi Responsive Mobile & Desktop pada Career, Navbar, Feedback, Boss Fight, serta halaman ujian.
- [x] Implementasi fitur Feedback via WhatsApp untuk Guest dan Dashboard.
- [ ] Implementasi RLS Policy yang rapi di Supabase (tabel `user_progress`).
- [ ] Cek manual End-to-End alur Boss Fight di live site Vercel.
- [D] / [C] Lanjutkan pengembangan V3.0 jika diperlukan.
