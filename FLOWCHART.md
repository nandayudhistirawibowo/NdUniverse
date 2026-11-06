# siDeutsch — Alur Aplikasi

## Login dan Proteksi Rute

```mermaid
flowchart TD
    A[Pengguna membuka portal login] --> B{Portal?}
    B -->|Pengguna /login| C[Masukkan email atau NIM dan kata sandi]
    C --> D{Email atau NIM valid?}
    D -->|Tidak| E[Tampilkan pesan validasi]
    D -->|Ya| F{Input berupa email?}
    F -->|Ya| G[Gunakan email]
    F -->|NIM| H[Bentuk email Supabase dari NIM lama]
    G --> I[Cek akun: sign-in dengan email dan kata sandi]
    H --> I
    I -->|Berhasil| J[Dashboard pengguna]
    I -->|Invalid login credentials| K[Coba auto-signup dengan email dan kata sandi]
    I -->|Error lain| E
    K -->|Akun baru berhasil dibuat| L[Sign-in ulang]
    L -->|Berhasil| M[Buat profil dengan NIM nullable bila perlu]
    M --> J
    K -->|Akun sudah terdaftar atau signup gagal| E

    B -->|Admin /admin/login| K[Masukkan NIM dan password]
    K --> L{NIM admin diizinkan?}
    L -->|Tidak| M[Tolak akses]
    L -->|Ya| N[Sign-in Supabase]
    N --> O{Profil terautentikasi adalah admin?}
    O -->|Tidak| P[Sign-out dan tolak akses]
    O -->|Ya| Q[Panel admin /admin]

    R[Request tanpa sesi ke /dashboard atau /career] --> S[Middleware mengarahkan ke /login]
    T[Request tanpa sesi ke /admin] --> U[Middleware mengarahkan ke /admin/login]
```

## Kuis Materi Utama, XP, dan Progress

```mermaid
flowchart TD
    A[Pilih Alltagsdeutsch atau Fachdeutsch] --> B[Pilih materi]
    B --> C[Halaman detail materi]
    C --> D{Login?}
    D -->|Ya| E[Lihat materi dan progress]
    D -->|Guest| F[Lihat preview dan kosakata sesi pertama]
    E --> G[Pilih sesi, maksimal 5 kata]
    F --> H[Mulai sesi pertama]
    G --> I[Mulai kuis]
    H --> I
    I --> J[Pilih tipe: Arrange, Matcher, atau Text Box]
    J --> K{Jawaban benar?}
    K -->|Ya| L[Tambah 10 XP ke state sementara sesi]
    K -->|Tidak| M[Kurangi 1 nyawa dan catat kata sulit]
    L --> N{Masih ada soal?}
    M --> O{Nyawa habis?}
    O -->|Ya| P[Game Over: reset XP sementara, jangan komit]
    O -->|Tidak| N
    N -->|Ya| J
    N -->|Tidak| Q[Kuis selesai]
    Q --> R[Guard finalisasi: komit XP sementara sekali untuk run ini]
    R --> S{Login?}
    S -->|Ya| T[Perbarui total XP dan antrekan upsert Supabase]
    S -->|Tidak| U[Progress guest tetap di memori]
    Q --> V{Akurasi minimal 80%?}
    V -->|Ya| W[Tandai sesi lulus]
    V -->|Tidak| X[Sesi gagal; XP kuis selesai tetap dapat dikomit]
    W --> Y[Level dashboard dihitung dari sesi lulus CEFR]
```

XP dikomit setelah kuis selesai, tidak saat setiap jawaban benar. Game Over membuang XP sementara. Guard mencegah finalisasi ganda pada satu run, tetapi implementasi saat ini tidak membatasi perolehan XP saat pengguna memainkan ulang kuis yang sudah selesai.

## Review Kata Sulit dan Bookmark

```mermaid
flowchart LR
    A[Kuis selesai atau Game Over] --> B[Review Kata Sulit]
    B --> C[Klik ikon Bookmark pada kata]
    C --> D{Kata sudah tersimpan?}
    D -->|Belum| E[Simpan german, indonesian, context]
    D -->|Sudah| F[Tidak menambahkan duplikat]
    E --> G[localStorage: sideutsch-bookmarks]
    F --> G
    G --> H[Buka /dashboard/bookmark]
    H --> I[Tampilkan daftar bookmark]
    I --> J[Hapus kata]
    J --> G
```

Bookmark adalah data client-side di browser; bookmark tidak disimpan atau disinkronkan ke Supabase.

## Career

```mermaid
flowchart LR
    A[Klik menu Career] --> B[Katalog /career]
    B --> C[Pilih materi Career]
    C --> D[Halaman detail kosakata Career]
    D -. "kuis Career belum tersedia" .-> E[Latihan Career: pengembangan mendatang]
```

Collection Career dan halaman detail vocab telah tersedia dan rute `/career` dilindungi login. Kuis Career belum diimplementasikan pada codebase saat ini.

## Sinkronisasi Progress Supabase

```mermaid
flowchart TD
    A[Kuis dimulai atau catatan dibuka] --> B{Ada sesi Supabase?}
    B -->|Tidak| C[Guest: progress kuis berada di memori]
    B -->|Ya| D[Muat user_progress untuk user dan materi]
    D --> E[Gabungkan progress server dan fallback lokal]
    E --> F[Kuis selesai, sesi lulus, atau catatan berubah]
    F --> G[Simpan fallback lokal untuk pengguna login]
    G --> H[Antrekan upsert user_id + material_slug]
    H --> I{Upsert berhasil?}
    I -->|Ya| J[Perbarui xp, sessions_passed, notes, updated_at]
    I -->|Tidak| K[Fallback lokal tetap tersedia]
```

`user_progress.sessions_passed` disimpan sebagai array JSONB nomor sesi. RLS membatasi baris ke pemilik melalui `auth.uid() = user_id`.

## Navigasi dan Audio

```mermaid
flowchart TD
    A[Hover atau fokus pada link internal] --> B[Astro prefetch]
    A --> C[Klik link]
    C --> D[Tampilkan loading progress]
    D --> E[Ambil halaman SSR dan tukar DOM]
    E --> F[Inisialisasi script pada astro:page-load]

    G[Tekan tombol speaker] --> H{Web Speech API tersedia?}
    H -->|Tidak| I[Tombol disabled]
    H -->|Ya| J[Atur lang de-DE]
    J --> K[Ucapkan kata atau kalimat Jerman]
```

Prefetch membantu menghangatkan halaman internal, tetapi tidak menjamin SSR selesai sebelum klik. Audio bergantung pada Web Speech API dan voice Jerman browser/OS.
