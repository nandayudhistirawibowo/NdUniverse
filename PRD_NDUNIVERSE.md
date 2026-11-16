# NdUniverse - Product Requirements Document

## Visi

NdUniverse adalah platform induk multi-bahasa yang menghubungkan pembelajaran bahasa, pemahaman budaya, sertifikasi internasional, dan kesiapan karir global dalam satu pengalaman terpadu.

Platform ini menjadi gerbang utama untuk berbagai modul bahasa. Setiap modul dapat memiliki kurikulum, sistem latihan, ujian, autentikasi, dan dashboard yang disesuaikan dengan kebutuhan bahasanya, tanpa kehilangan identitas utama NdUniverse.

## Status Rilis

- Source saat ini menyediakan modul German dan English dengan materi belajar, latihan, ujian, dan progress pada route yang tersedia.
- NdBot v2 berbasis RAG, audio English dua aksen, latihan empat pilar tanpa urutan/locking paksa, dan anti-cheat ujian tiga strike termasuk dalam lingkup fitur.
- Status deployment, migrasi database, dan kesiapan rilis harus diverifikasi pada environment tujuan; dokumen ini tidak mengklaim validasi production.

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

Modul English tersedia, dengan fokus produk pada:

- Persiapan IELTS dan TOEFL.
- Latihan Reading, Listening, Writing, dan Speaking.
- Materi akademik dan komunikasi profesional.
- Simulasi ujian dengan penilaian dan feedback terukur.
- Pengembangan aset audio bahasa Inggris melalui Edge TTS.

Route Everyday English, Academic English, Career Prep, dan Exam Prep IELTS/TOEFL tersedia. Produksi audio English memakai Edge TTS dengan voice `en-US` atau `en-GB`; aset yang dikonfigurasi sebagai CDN disajikan melalui jsDelivr.

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

Landing page mengenalkan produk dan menyediakan kartu modul yang menautkan langsung ke `/login-en` dan `/login-de`. Route `/en` dan `/de` menjadi halaman modul; tautan antar-route tersebut hanya navigasi modul, bukan pengubah bahasa UI.

## Prinsip Produk

- **Modular:** setiap bahasa dapat berkembang sebagai modul mandiri di bawah NdUniverse.
- **Terukur:** kurikulum, latihan, dan ujian mengikuti standar internasional seperti CEFR, IELTS, TOEFL, dan Goethe-Zertifikat.
- **Berorientasi tujuan:** pembelajaran diarahkan ke studi, sertifikasi, komunikasi, dan karir.
- **Cross-device:** pengalaman harus nyaman di desktop, tablet, dan mobile.
- **Konsisten:** NdUniverse menjadi identitas induk, sementara modul bahasa memiliki konten dan alur khusus.
- **Bertahap:** landing mengarahkan user ke login modul, lalu dashboard mengatur perjalanan belajar.

## Fondasi Teknis

- Landing root berada di `src/pages/index.astro` dan tidak memakai sidebar atau navbar dashboard.
- Route modul awal berada di `src/pages/en/index.astro` dan `src/pages/de/index.astro`.
- Layout publik memakai branding NdUniverse.
- Platform menggunakan Supabase untuk auth, database, storage, dan progress; audio yang dikonfigurasi CDN disajikan melalui jsDelivr.
- Chatbot memakai Supabase `pgvector` untuk retrieval, Cloudflare Workers AI untuk embedding, dan Groq untuk query rewrite serta jawaban berbasis materi.
- XP kuis sementara dibatalkan saat Game Over dan dilindungi dari finalisasi ganda pada run yang sama.
- UI Indonesian-first: Bahasa Indonesia hardcoded tanpa sistem i18n. Dashboard dan NdBot menggunakan Bahasa Indonesia penuh; landing/portal/login masih memiliki sisa English copy yang masuk backlog audit. Materi belajar tetap memakai bahasa target.
- Kuis mengizinkan pemilihan sesi dan pilar tanpa prasyarat atau urutan wajib; `sessions_passed` hanya menandai progres.
- SEO: landing `index, follow` dan canonical; dashboard `noindex, nofollow` serta dikecualikan dari sitemap.
