# siDeutsch — Alur Aplikasi

## Login, Auto-signup, dan Proteksi Rute

```mermaid
flowchart TD
    A[Pengguna membuka /login] --> B[Masukkan Email/NIM dan Password]
    B --> C{Format input valid?}
    C -->|Tidak| D[Tampilkan pesan validasi]
    C -->|Ya| E[Normalisasi Email atau ubah NIM lama menjadi email]
    E --> F[Sistem cek akun ke Supabase: signInWithPassword]
    F -->|Berhasil| G[Siapkan atau periksa profil]
    G --> H[Masuk ke Dashboard]
    F -->|Invalid login credentials| I[Coba auto-signup dengan email dan password]
    F -->|Error lain| J[Tampilkan pesan error yang sesuai]
    I -->|Akun berhasil dibuat dan dapat langsung masuk| K[Sign-in ulang ke Supabase]
    K --> L[Buat profil; nim boleh NULL untuk akun umum]
    L --> H
    I -->|Akun sudah terdaftar, konfirmasi diperlukan, atau signup gagal| J

    M[Admin membuka /admin/login] --> N[Masukkan NIM dan Password admin]
    N --> O[Sign-in dan validasi profil admin]
    O -->|Valid| P[Panel /admin]
    O -->|Tidak valid| Q[Sign-out atau tampilkan penolakan]

    R[Pengguna belum login membuka /dashboard, /career, atau /bantuan] --> S[Middleware mengarahkan ke /login]
    T[Pengguna belum login membuka /admin] --> U[Middleware mengarahkan ke /admin/login]
```

NIM lama tetap diterjemahkan ke alamat Supabase `NIM@student.sideutsch.com`; email pengguna umum dipakai langsung. Materi publik dapat dilihat tanpa login, tetapi dashboard dan rute privat memerlukan autentikasi.

## Kuis, XP, dan Progress

```mermaid
flowchart TD
    A[Pilih Alltagsdeutsch atau Fachdeutsch] --> B[Pilih materi dan sesi]
    B --> C[Mulai sesi kuis dengan 3 nyawa]
    C --> D[Pilih tipe soal: Susun Kata, Matcher, atau Text Box]
    D --> E{Jawaban benar?}
    E -->|Ya| F[Tambah 10 XP ke state sementara]
    E -->|Tidak| G[Kurangi satu nyawa dan catat kata sulit]
    F --> H{Masih ada soal?}
    G --> I{Nyawa habis?}
    I -->|Ya| J[Game Over: buang XP sementara]
    I -->|Tidak| H
    H -->|Ya| D
    H -->|Tidak| K[Sesi selesai]
    K --> L[Finalisasi XP sesi satu kali untuk run ini]
    L --> M{Pengguna login?}
    M -->|Ya| N[Simpan XP ke total dan sinkronkan user_progress di Supabase]
    M -->|Tidak| O[Progress tidak tersinkron ke akun]
    K --> P{Akurasi minimal 80 persen?}
    P -->|Ya| Q[Tandai sesi lulus]
    P -->|Tidak| R[Sesi tidak lulus; XP sesi selesai tetap dikomit]
    Q --> S[Hitung poin level dari sesi CEFR yang lulus]
```

XP jawaban benar hanya disimpan sementara sampai sesi selesai; Game Over membuang XP yang belum dikomit. Guard finalisasi mencegah run yang sama disimpan dua kali. Implementasi belum mencegah XP didapat lagi dari replay sesi yang telah selesai, sehingga ini bukan pembatas replay lintas sesi.

## Review Kata Sulit dan Bookmark

```mermaid
flowchart LR
    A[Sesi kuis selesai atau Game Over] --> B[Tampilkan Review Kata Sulit]
    B --> C[Klik ikon Bookmark pada kata]
    C --> D{Kata sudah tersimpan?}
    D -->|Belum| E[Simpan german, indonesian, dan context]
    D -->|Sudah| F[Jangan buat duplikat]
    E --> G[localStorage: sideutsch-bookmarks]
    F --> G
    G --> H[Buka /dashboard/bookmark]
    H --> I[Lihat atau hapus bookmark]
```

Bookmark hanya disimpan di browser dan tidak disinkronkan ke Supabase.

## Career dan Bantuan

```mermaid
flowchart LR
    A[Klik Career di sidebar] --> B[Buka /career]
    B --> C[Tampilkan status Coming Soon]
    D[Klik Bantuan di sidebar] --> E[Buka /bantuan]
    E --> F[Baca panduan akun, kuis, XP, bookmark, dan password]
    G[Klik Profil Saya di dropdown akun] --> H[Buka /dashboard/profil]
    H --> I[Ganti password atau perbarui profil]
```

Halaman Career dan Bantuan berada di area login; kuis Career belum tersedia.

## Sinkronisasi Progress Supabase

```mermaid
flowchart TD
    A[Pengguna login dan membuka materi] --> B[Muat user_progress untuk user dan materi]
    B --> C[Gabungkan data server dengan fallback lokal]
    C --> D[Kuis sesi selesai, sesi lulus, atau catatan berubah]
    D --> E[Simpan fallback lokal]
    E --> F[Antrekan upsert user_id dan material_slug]
    F --> G{Upsert berhasil?}
    G -->|Ya| H[Perbarui xp, sessions_passed, notes, updated_at]
    G -->|Tidak| I[Pertahankan fallback lokal]
```

`user_progress.sessions_passed` adalah array JSONB nomor sesi. RLS membatasi baris ke pemilik melalui `auth.uid() = user_id`.
