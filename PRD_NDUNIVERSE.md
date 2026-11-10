# NdUniverse - Product Requirements Document

## Visi

NdUniverse adalah platform induk multi-bahasa yang menghubungkan pembelajaran bahasa, pemahaman budaya, sertifikasi internasional, dan kesiapan karir global dalam satu pengalaman terpadu.

Platform ini menjadi gerbang utama untuk berbagai modul bahasa. Setiap modul dapat memiliki kurikulum, sistem latihan, ujian, autentikasi, dan dashboard yang disesuaikan dengan kebutuhan bahasanya, tanpa kehilangan identitas utama NdUniverse.

## Status Rilis

- Modul German: 100% Selesai.
- Modul English: Fondasi UI & Routing Selesai (Konten & TTS menyusul).

## Target User

- Pelajar dan mahasiswa yang ingin membangun kemampuan bahasa untuk studi atau mobilitas internasional.
- Profesional yang memerlukan kemampuan bahasa untuk karir global.
- Peserta ujian bahasa yang mempersiapkan sertifikasi internasional.
- Pembelajar mandiri yang membutuhkan materi terstruktur dari tingkat dasar hingga mahir.
- Institusi pendidikan dan komunitas yang membutuhkan ruang belajar bahasa yang terukur.

## Modul Bahasa

### German

Route utama: `/de`

Modul German adalah modul aktif utama, dengan fokus pada:

- Alltagsdeutsch untuk komunikasi sehari-hari tingkat A1-C2.
- Fachdeutsch untuk kosakata akademik dan profesional.
- Empat pilar CEFR: Reading, Listening, Writing, dan Speaking.
- Persiapan Goethe-Zertifikat dan simulasi ujian per level.
- Career dan Boss Fight untuk latihan wawancara kerja berbahasa Jerman.
- Audio bahasa Jerman berbasis aset Edge TTS yang sudah tersedia.
- TTS 2 Tombol (Kata & Kalimat).
- Mobile Touch Target 44px untuk kontrol interaktif pada layar kecil.

### English

Route utama: `/en`

Fondasi Modul English tersedia, dengan fokus produk pada:

- Persiapan IELTS dan TOEFL.
- Latihan Reading, Listening, Writing, dan Speaking.
- Materi akademik dan komunikasi profesional.
- Simulasi ujian dengan penilaian dan feedback terukur.
- Pengembangan aset audio bahasa Inggris melalui Edge TTS.

Route Everyday English dan Exam Prep IELTS/TOEFL sudah tersedia dengan contoh soal A1. Pengisian konten skala penuh dan aset audio English menyusul. Untuk audio English, gunakan Edge TTS dengan voice `en-US` atau `en-GB`; file MP3 dibuat bertahap sesuai materi.

## Struktur Navigasi

```text
Landing NdUniverse (/)
  -> Pilih Bahasa
      -> English (/en)
          -> Login / Masuk
          -> Dashboard English
      -> German (/de)
          -> Login / Masuk
          -> Dashboard German
              -> Alltagsdeutsch
              -> Fachdeutsch
              -> Ujian dan Sertifikasi
              -> Career
```

Landing page hanya berfungsi sebagai gerbang pengenalan dan pemilihan modul. Login tidak ditampilkan di landing page; autentikasi menjadi bagian dari pengalaman masing-masing modul bahasa.

## Prinsip Produk

- **Modular:** setiap bahasa dapat berkembang sebagai modul mandiri di bawah NdUniverse.
- **Terukur:** kurikulum, latihan, dan ujian mengikuti standar internasional seperti CEFR, IELTS, TOEFL, dan Goethe-Zertifikat.
- **Berorientasi tujuan:** pembelajaran diarahkan ke studi, sertifikasi, komunikasi, dan karir.
- **Cross-device:** pengalaman harus nyaman di desktop, tablet, dan mobile.
- **Konsisten:** NdUniverse menjadi identitas induk, sementara modul bahasa memiliki konten dan alur khusus.
- **Bertahap:** landing mengarahkan user ke bahasa, modul mengarahkan ke login, lalu dashboard mengatur perjalanan belajar.

## Fondasi Teknis Tahap 1

- Landing root berada di `src/pages/index.astro` dan tidak memakai sidebar atau navbar dashboard.
- Route modul awal berada di `src/pages/en/index.astro` dan `src/pages/de/index.astro`.
- Layout publik memakai branding NdUniverse.
- Auth, Supabase, dan aset audio German yang sudah ada tidak diubah pada tahap fondasi UI.
