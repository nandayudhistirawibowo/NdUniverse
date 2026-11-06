# siDeutsch — Alur Aplikasi

## Login Mahasiswa dan Admin

```mermaid
flowchart TD
    A[Pengguna membuka portal login] --> B{Portal yang dipilih?}
    B -->|Mahasiswa /login| C[Masukkan NIM dan password]
    C --> D{NIM valid dan bukan NIM admin?}
    D -->|Tidak| E[Tampilkan penolakan / validasi]
    D -->|Ya| F[Email Supabase dibentuk dari NIM]
    F --> G{Sign-in berhasil?}
    G -->|Ya| H[Dashboard mahasiswa]
    G -->|Tidak| I{Akun mahasiswa belum ada?}
    I -->|Ya| J[Signup mahasiswa; password awal = NIM]
    J --> H
    I -->|Tidak| E

    B -->|Admin /admin/login| K[Masukkan NIM dan password]
    K --> L{NIM admin yang diizinkan?}
    L -->|Tidak| M[Tolak sebelum sign-in]
    L -->|Ya| N[Sign-in Supabase]
    N --> O{Profil terautentikasi punya NIM admin?}
    O -->|Tidak| P[Sign-out dan tolak akses]
    O -->|Ya| Q[Admin panel /admin]

    R[Request ke /admin tanpa sesi] --> S[Middleware mengarahkan ke /admin/login]
    T[Request ke /dashboard tanpa sesi] --> U[Middleware mengarahkan ke /login]
```

NIM admin di helper saat ini adalah `admin` dan `000000`. Otorisasi admin dilakukan kembali di middleware dan Admin API; path login terpisah bukan pengganti pemeriksaan hak akses.

## Alur Belajar dan Kuis

```mermaid
flowchart TD
    A[Masuk ke katalog Alltagsdeutsch atau Fachdeutsch] --> B[Pilih materi]
    B --> C[Halaman detail materi]
    C --> D{Login?}
    D -->|Ya| E[Lihat materi lengkap dan progress]
    D -->|Guest| F[Lihat preview dan kosakata Sesi 1]
    E --> G[Pilih sesi, maksimal 5 kata]
    F --> H[Mulai kuis Sesi 1]
    G --> I[Mulai kuis]
    H --> I
    I --> J[Pilih tipe soal: susun, matcher, atau cloze]
    J --> K{Jawaban benar?}
    K -->|Ya| L[Tambah 10 XP]
    K -->|Tidak| M[Kurangi 1 nyawa dan catat kata sulit]
    L --> N{Masih ada soal?}
    M --> O{Nyawa tersisa?}
    O -->|Tidak| P[Ringkasan / game over]
    O -->|Ya| N
    N -->|Ya| J
    N -->|Tidak| Q{Akurasi sesi minimal 80%?}
    Q -->|Ya| S[Tandai sesi lulus]
    Q -->|Tidak| P
    S --> T[User login: sinkronkan XP dan sesi]
    S --> U[Guest: progress tetap di memori]
    T --> V[Hitung level dari sesi CEFR yang lulus]
```

## Guest Mode

```mermaid
flowchart TD
    A[Guest membuka detail materi] --> B[Tampilkan tabel Sesi 1 saja]
    B --> C[Tampilkan sesi 2+ sebagai terkunci]
    C --> D[Guest dapat kembali ke kurikulum publik]
    C --> E[Guest dapat mencoba kuis Sesi 1]
    E --> F[XP dan status kuis disimpan di state komponen]
    F --> G{Halaman dimuat ulang?}
    G -->|Ya| H[State hilang, mulai dari 0]
    G -->|Tidak| I[Guest lanjut bermain]
    C --> J[CTA login untuk membuka materi/progress]
```

## Sinkronisasi Progress Supabase

```mermaid
flowchart TD
    A[Kuis atau catatan dibuka] --> B{Ada sesi Supabase?}
    B -->|Tidak| C[Guest: tidak menulis localStorage/sessionStorage progress]
    C --> D[Progress berada di memori saja]
    B -->|Ya| E[Muat user_progress untuk user dan material]
    E --> F[Gabungkan data server dengan localStorage fallback]
    F --> G[Jawaban benar / sesi lulus / catatan berubah]
    G --> H[Simpan fallback lokal untuk user login]
    H --> I[Antrekan upsert per user_id + material_slug]
    I --> J{Request Supabase berhasil?}
    J -->|Ya| K[Perbarui user_progress dan updated_at]
    J -->|Tidak| L[Fallback lokal tetap tersedia]
    L --> M[Merge dicoba kembali saat progress dimuat pada sesi berikutnya]
```

`user_progress.sessions_passed` disimpan sebagai array JSONB nomor sesi, `xp` per materi, dan `notes` per materi. RLS membatasi baris ke pemilik berdasarkan `auth.uid() = user_id`.

## Navigasi, TTS, dan Konten Publik

```mermaid
flowchart TD
    A[Pengguna membuka link internal] --> B[Hover atau fokus pada link]
    B --> C[Astro prefetch halaman tujuan]
    A --> D[Klik link / navigasi dimulai]
    D --> E[astro:before-preparation: tampilkan loading bar]
    E --> F[Astro mengambil halaman SSR dan menukar DOM]
    F --> G[astro:page-load: sembunyikan loading bar dan inisialisasi script halaman]

    H[Pengguna menekan tombol speaker] --> I{Web Speech API tersedia?}
    I -->|Tidak| J[Tombol disabled]
    I -->|Ya| K[Buat SpeechSynthesisUtterance]
    K --> L[Set lang de-DE]
    L --> M[window.speechSynthesis mengucapkan teks Jerman]

    N[Konten belajar publik] --> O[Panduan Pengucapan /grammar]
    N --> P[Detail materi: kosakata + context + contextIndonesian opsional]
    P --> Q[Contoh Jerman tampil dengan arti kecil jika tersedia]
```

Prefetch menggunakan strategi hover/focus dan membantu menghangatkan halaman internal, tetapi tidak menjamin SSR selesai sebelum klik. TTS menggunakan voice Jerman yang tersedia di browser/OS; tombol dimatikan jika Web Speech API tidak didukung.
