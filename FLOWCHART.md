# siDeutsch — Alur Aplikasi

## Login dan Auto-Signup

```mermaid
flowchart TD
    A[Pengguna membuka login] --> B[Masukkan email atau NIM dan password]
    B --> C{Input valid?}
    C -->|Tidak| D[Tampilkan validasi]
    C -->|Ya| E[Normalisasi email atau NIM]
    E --> F[Coba login ke Supabase]
    F -->|Berhasil| G[Siapkan atau muat profil]
    G --> H[Masuk dashboard]
    F -->|Invalid login credentials| I[Auto-signup akun baru]
    I -->|Berhasil| J[Login ulang]
    J --> K[Buat profil]
    K --> H
    I -->|Konfirmasi email diperlukan atau gagal| L[Tampilkan pesan error]
```

## Alur Detail Materi dan Pilihan Pilar

```mermaid
flowchart TD
    A[Buka detail materi] --> B[Pilih sesi 1 sampai 4]
    B --> C[Pilih satu dari empat pilar]
    C --> D{Pilar dipilih}
    D -->|Reading| E[Buka kuis type reading]
    D -->|Listening| F[Buka kuis type listening]
    D -->|Writing| G[Buka kuis type writing]
    D -->|Speaking| H[Buka kuis type speaking]
    E --> I[Filter lima kosakata sesi]
    F --> I
    G --> I
    H --> I
```

## Alur Kuis 4 Pilar

```mermaid
flowchart TD
    A[User pilih pilar latihan] --> B[Ambil query type dan session]
    B --> C[Filter maksimal lima kosakata berdasarkan session]
    C --> D[Generate lima soal sesuai pilar]
    D --> E{Mulai nyawa}
    E --> F[Kerjakan Reading Listening Writing atau Speaking]
    F --> G{Jawaban benar?}
    G -->|Ya| H[Tambah 10 XP ke state sesi sementara]
    G -->|Tidak| I[Kurangi satu nyawa]
    I --> J[Tambahkan kata sulit ke Review]
    J --> K{Nyawa habis?}
    K -->|Ya| L[Game Over]
    L --> M[XP sementara dibuang]
    K -->|Tidak| N{Masih ada soal?}
    H --> N
    N -->|Ya| F
    N -->|Tidak| O[Sesi selesai]
    O --> P[Finalisasi XP sekali untuk run ini]
    P --> Q{Pengguna login?}
    Q -->|Ya| R[Upsert XP dan pilar lulus ke Supabase]
    Q -->|Tidak| S[Ambil cache lokal hanya untuk browser]
    R --> T[Perbarui total progress dan level]
    S --> T
```

Reading memakai teks dan pilihan ganda; Listening memakai audio/TTS dan pilihan ganda; Writing memakai text box fuzzy matching; Speaking memakai microphone atau text box. Anti-farming membuang XP sementara saat Game Over dan menggunakan guard finalisasi run agar XP tidak dikomit dua kali.

## Sinkronisasi `sessions_passed`

```mermaid
flowchart TD
    A[Muat progress materi] --> B{Format sessions_passed}
    B -->|String pilar| C[Gunakan empat nama pilar]
    B -->|Array lama| D[Konversi nomor sesi menjadi nama pilar]
    C --> E[Gabungkan pilar yang lulus]
    D --> E
    E --> F{Keempat pilar lengkap?}
    F -->|Ya| G[Materi lulus]
    F -->|Tidak| H[Materi belum lulus]
    G --> I{Track Alltagsdeutsch dan level CEFR?}
    I -->|Ya| J[Tambahkan poin level sesuai A1 sampai C2]
    I -->|Tidak| K[Fachdeutsch atau Career tidak menambah level]
    E --> L[Upsert JSON array ke Supabase]
```

## Alur Mock Exam 22 Soal

```mermaid
flowchart TD
    A[Buka ujian level] --> B[Generate 22 task]
    B --> C[10 Lesen]
    B --> D[10 Hören]
    B --> E[1 Schreiben]
    B --> F[1 Sprechen]
    C --> G[Jawab seluruh task]
    D --> G
    E --> G
    F --> G
    G --> H[Hitung skor]
    H --> I{Skor minimal 60 persen?}
    I -->|Ya| J[Simpan status lulus di localStorage]
    J --> K[Tampilkan tombol Lihat Sertifikat]
    I -->|Tidak| L[Tampilkan hasil gagal]
```

## Alur Simulasi Goethe-Zertifikat

```mermaid
flowchart TD
    A[User klik Simulate Goethe-Zertifikat] --> B[Pilih level A1 sampai C2]
    B --> C[Masuk modul Lesen]
    C --> D[Timer Lesen berjalan]
    D --> E{Timer habis atau modul selesai?}
    E -->|Ya| F[Masuk Hören]
    F --> G[Timer Hören berjalan]
    G --> H{Timer habis atau modul selesai?}
    H -->|Ya| I[Masuk Schreiben]
    I --> J[Timer Schreiben berjalan]
    J --> K{Timer habis atau modul selesai?}
    K -->|Ya| L[Masuk Sprechen]
    L --> M[Timer Sprechen berjalan]
    M --> N{Timer habis atau modul selesai?}
    N -->|Ya| O[Hitung skor terpisah empat modul]
    O --> P{Setiap modul minimal 60 persen?}
    P -->|Ya| Q[Simpan status sideutsch-goethe-level]
    Q --> R[Lulus keseluruhan]
    R --> S[Generate sertifikat PDF]
    P -->|Tidak| T[Gagal keseluruhan]
    T --> U[Tampilkan status gagal per modul dan tombol Perbaiki Skillku]
```

Timer dibatasi sesuai konfigurasi level. Hasil menunjukkan skor, rating, feedback Lesen, transkrip Hören, serta kata kunci Writing/Speaking. Semua modul wajib mencapai 60%.

## Alur TTS

```mermaid
flowchart TD
    A[Pengguna menekan tombol Speaker] --> B[Normalisasi teks Jerman]
    B --> C[Cari teks tepat pada manifest.json]
    C --> D{Audio Path ditemukan?}
    D -->|Tidak| E[Fallback Web Speech API]
    D -->|Ya| F[Hentikan audio lama]
    F --> G[Putar MP3 statis]
    G --> H{MP3 berhasil diputar?}
    H -->|Ya| I[Selesai]
    H -->|Tidak| E
    E --> J{Web Speech API tersedia?}
    J -->|Ya| K[Bacakan lang de-DE]
    J -->|Tidak| L[Tampilkan indikator berhenti dan log error]
```

Lookup manifest memakai teks yang dikirim, bukan nama atau pencocokan substring. File MP3 berada di `public/audio/tts/`; jika manifest atau audio gagal, browser memakai Web Speech API dengan `lang = 'de-DE'`.

## Alur Bookmark

```mermaid
flowchart LR
    A[Kuis selesai] --> B[Buka Review Kata Sulit]
    B --> C[Klik bookmark kata]
    C --> D{kata Jerman sudah ada?}
    D -->|Ya| E[Jangan duplikat]
    D -->|Belum| F[Simpan german indonesian context]
    F --> G[localStorage sideutsch-bookmarks]
    E --> G
```

Bookmark tidak disinkronkan ke Supabase dan dihapus/ditampilkan dari browser yang sama.

## Alur Sertifikat Goethe

```mermaid
flowchart TD
    A[Ujian Goethe dinyatakan lulus] --> B[Buka halaman sertifikat]
    B --> C[Validasi status di localStorage]
    C -->|Lulus| D[Isi nama level dan tanggal kelulusan]
    D --> E[Klik Download PDF]
    E --> F[html2pdf membuat PDF client-side]
    C -->|Belum lulus| G[Tolak akses download]
```
