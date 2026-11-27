# NdUniverse — Alur Aplikasi

## Status Modul

NdUniverse V4 mencakup modul belajar German dan English, chatbot RAG, progress, dan ujian. Pengguna wajib login untuk mengakses dashboard dan fitur pembelajaran. Antarmuka menggunakan Bahasa Indonesia hardcoded; bahasa materi mengikuti modul.

## Alur Utama

```mermaid
flowchart LR
    A[Landing NdUniverse] --> B[Pilih Jerman atau Inggris]
    B --> C[Login]
    C --> D[Dashboard]
    D --> E[Kuis 4 Pilar]
    D --> F[Ujian Goethe / IELTS]
    D --> G[Career dan Boss Fight]
    F --> H[Hasil dan Sertifikat]
```

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

## Alur Ujian Inggris

```mermaid
flowchart TD
    A[User membuka /en/exam/ielts atau /en/exam/toefl] --> B[Pilih level]
    B --> C[Masuk ke ujian empat modul]
    C --> D[Reading: timer berjalan]
    D --> E[Listening: timer berjalan]
    E --> F[Writing: timer berjalan]
    F --> G[Speaking: timer berjalan]
    G --> H[Hitung skor setiap modul]
    H --> I{Setiap modul mencapai minimal 60%?}
    I -->|Ya| J[LULUS]
    I -->|Tidak| K[GAGAL]
```

## Alur Detail Materi dan Pilihan Pilar

```mermaid
flowchart TD
    A[Buka detail materi] --> B[Pilih Reading atau Listening atau Writing atau Speaking]
    B --> C{Pilar dipilih}
    C -->|Reading| D[Buka kuis type reading]
    C -->|Listening| E[Buka kuis type listening]
    C -->|Writing| F[Buka kuis type writing]
    C -->|Speaking| G[Buka kuis type speaking]
    D --> H[Filter maksimal lima kosakata dari data pilar]
    E --> H
    F --> H
    G --> H
```

## Alur Kuis 4 Pilar (Tanpa Locking)

```mermaid
flowchart TD
    A[User pilih pilar latihan] --> B[Ambil query type dan session]
    B --> C[Filter maksimal lima kosakata berdasarkan session]
    C --> D[Generate maksimal lima soal sesuai pilar]
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
    O --> P{Empat pilar sesi ini sudah tuntas sebelumnya?}
    P -->|Ya| Q[Tidak memberi XP ulang]
    P -->|Tidak| R[Finalisasi XP sekali untuk run ini]
    R --> S[Cap XP materi pada 800]
    S --> T[Upsert XP dan pilar lulus ke Supabase]
    T --> U[Perbarui total progress dan level]
```

Standar materi adalah 4 sesi × 5 kosakata. Jawaban benar bernilai 10 XP, maksimal 50 XP per pilar dan 200 XP per sesi, dengan batas 800 XP per materi. Reading memakai teks dan pilihan ganda; Listening memakai audio/TTS dan pilihan ganda; Writing memakai text box fuzzy matching; Speaking memakai microphone atau text box. XP sementara dibuang saat Game Over, run hanya difinalisasi sekali, dan pengulangan sesi yang seluruh empat pilarnya sudah selesai tidak memberi XP tambahan.

## Pemilihan Sesi dan Pilar Kuis

```mermaid
flowchart TD
    A[Buka detail materi] --> B[Pilih sesi yang tersedia]
    B --> C[Pilih Reading, Listening, Writing, atau Speaking]
    C --> D[Buka URL dengan session dan type]
    D --> E[Ambil batch sesi dan data pilar]
    E --> F[Kerjakan kuis]
    F --> G{Kuis lulus?}
    G -->|Belum| H[Ulangi atau kembali ke materi]
    G -->|Ya| I[Simpan kunci s{session}-{pillar}]
    I --> J[Perbarui indikator progres]
    J --> K[Kembali ke materi]
```

Sesi dan pilar tidak memerlukan progres sebelumnya, tidak memiliki urutan wajib/locking, dan dapat dibuka langsung melalui URL. Kunci progres hanya menandai pasangan sesi-pilar yang telah selesai; tombol setelah kuis kembali ke materi, bukan memaksa kuis berikutnya.

## NdBot v2 — Chatbot RAG

```mermaid
flowchart TD
    A[Pertanyaan user] --> B[Groq menulis ulang query]
    B -->|Gagal| C[Gunakan pertanyaan asli]
    B -->|Berhasil| D[Gunakan query hasil rewrite]
    C --> E[Cloudflare Workers AI membuat embedding 384 dimensi]
    D --> E
    E --> F[Supabase RPC match_documents]
    F --> G[Cari hingga 3 chunk dengan threshold 0.35]
    G --> H{Chunk relevan ditemukan?}
    H -->|Ya| I[Groq menyusun jawaban dari konteks materi]
    H -->|Tidak| J[Tampilkan fallback informatif]
    I --> K[Tampilkan jawaban di chatbot]
    J --> K
```

Materi Markdown diindeks ke `public.documents` melalui script ingest. Pembaruan indeks adalah proses manual dan ingest penuh mengganti seluruh baris tabel tersebut.

## Anti-Cheat Fullscreen (NdBot v2 — 3 Strikes)

```mermaid
flowchart TD
    A[Pengguna memulai ujian besar] --> B[Minta fullscreen dan aktifkan pengawasan]
    B --> C[Awasi fullscreen, tab tersembunyi, dan window blur]
    C --> D{Pelanggaran terdeteksi?}
    D -->|Tidak| C
    D -->|Ya| E[Tambah satu strike; cooldown 5 detik]
    E --> F[NdBot menampilkan status strike]
    F --> G{Strike mencapai 3?}
    G -->|Tidak| C
    G -->|Ya| H[Paksa kirim ujian]
    H --> I[Hitung dan tampilkan hasil]
```

Anti-cheat dipakai oleh ujian besar. Strike ketiga memicu submit paksa; NdBot menampilkan tingkat pelanggaran. Jika browser menolak fullscreen, ujian tetap dapat berjalan sesuai dukungan browser.

## Sinkronisasi `sessions_passed`

```mermaid
flowchart TD
    A[Muat progress materi] --> B{Format sessions_passed}
    B -->|Kunci baru sN-pillar| C[Gunakan indikator sesi dan pilar]
    B -->|Format lama| D[Normalisasi nilai lama]
    C --> E[Gabungkan/union progres yang telah tersimpan]
    D --> E
    E --> F[Tampilkan status pilar biner 100%/0% untuk pasangan yang selesai]
    F --> G[Pengguna tetap bebas memilih sesi dan pilar]
    G --> H[Jika lulus, upsert kunci sesi-pilar hasil merge]
```

## Progress Pencapaian Dashboard EN/DE

```mermaid
flowchart TD
    A[Dashboard membaca xp dari user_progress] --> B[Cap xp saat membaca menjadi maksimum 800]
    B --> C[Hitung persen: round xp / 800 × 100]
    C --> D{xp mencapai 800?}
    D -->|Ya| E[Tampilkan 100% dan progress bar penuh]
    D -->|Belum| F[Tampilkan persen hasil hitung]
    E --> G[Halaman materi: tiap pilar 0% atau 100%]
    F --> G
    G --> H[nd:progress-updated memperbarui tampilan setelah latihan]
```

Nilai dashboard/katalog memakai kolom `user_progress.xp` yang di-cap 800, lalu menghitung `Math.round((currentXp / 800) * 100)`. Model kurikulum standar menghasilkan 800 XP dari 4 sesi × 5 kosakata × 4 pilar × 10 XP. XP dicap oleh aplikasi/UI; schema DB tidak memiliki constraint maksimum 800. Sebagian materi Academic English yang masih memiliki 17–19 kosakata merupakan pengecualian konten dan belum mencapai cap melalui materi tersebut.

## Input Kuis/Ujian dan Filter Katalog

- Enter pada text box jawaban menjalankan aksi periksa/kirim/lanjut dengan validasi yang sama seperti tombol; Enter pada textarea mencegah baris baru, sedangkan Shift+Enter tetap membuat baris baru.
- Dropdown level katalog memfilter kartu langsung tanpa reload. `Semua Level` menampilkan semua kartu; nilai A1–C2 dicocokkan case-insensitive setelah normalisasi.
## Grading Artikel dan Fuzzy Matching

```mermaid
flowchart TD
    A[Jawaban kuis atau ujian teks] --> B[Periksa prompt melalui isArticleQuestion]
    B --> C{Soal grammar secara spesifik menguji artikel?}
    C -->|Tidak| D[Normalisasi mengabaikan artikel EN dan DE]
    C -->|Ya| E[Normalisasi mempertahankan artikel]
    D --> F[Exact atau fuzzy match untuk typo]
    E --> F
```

Entri artikel `the/a/an` dan `der/die/das` telah dihapus dari daftar kosakata materi; artikel tetap digunakan pada prompt grammar yang memang mengujinya.

## Alur Career dan Boss Fight Visual Novel

```mermaid
flowchart TD
    A[User membuka /de/career] --> B[Pilih salah satu profesi]
    B --> C[IT atau Business atau Health atau Nutrition]
    C --> D[Buka Materi 50 kosakata dan kuis kosakata]
    D --> E[Klik Mulai Wawancara]
    E --> F[Masuk /de/career/profesi/boss]
    F --> G[Tampilkan layar intro ruangan kantor]
    G --> H[User klik Ketuk Pintu]
    H --> I[Animasi pintu terbuka dan Boss masuk]
    I --> J[Boss menyampaikan salam HRD]
    J --> K[User klik Mulai Wawancara]
    K --> L[Game state berubah ke interview]
    L --> M[Tampilkan pertanyaan 1 dari 10 sebagai chat HRD]
    M --> N[User menjawab melalui text box atau hook STT]
    N --> O{Jawaban cocok keyword pertanyaan?}
    O -->|Ya| P[Tambah jumlah jawaban cocok]
    O -->|Tidak| Q[Simpan sebagai jawaban belum cocok]
    P --> R{Masih ada pertanyaan berikutnya?}
    Q --> R
    R -->|Ya| S[Tampilkan pertanyaan berikutnya]
    S --> N
    R -->|Tidak| T[Game state berubah ke finished]
    T --> U[Hitung jawaban cocok]
    U --> V{Mencapai ambang kelulusan?}
    V -->|Ya| W[Tampilkan Wawancara Selesai dan layar kemenangan]
    V -->|Tidak| X[Tampilkan hasil wawancara belum lulus]
    W --> Y[Klik Kembali ke Materi]
    X --> Y
```

Data Career German diambil dari Markdown pada `src/modules/german/content/career/*.md` melalui Astro Content Collection `career`. Pertanyaan disimpan pada `boss_questions` dan jawaban dinilai berdasarkan `keywords` dari pertanyaan aktif. Boss Fight juga tersedia di `/en/career/[profesi]/boss` dengan data English pada `src/modules/english/content/career/`. Hasil wawancara ditampilkan di browser; progress Boss Fight tidak disimpan ke Supabase.

Mic Boss Fight hanya menangkap jawaban peserta melalui hook STT. Audio dialog HRD tetap diputar terpisah oleh `boss-audio.js` dan sinkronisasi typewriter tidak memakai alur transkripsi.

## Alur Speech-to-Text

```mermaid
flowchart TD
    A[Pengguna menekan mic] --> B{Mikrofon diizinkan dan browser mendukung rekaman?}
    B -->|Tidak| C[Coba Web Speech API atau tampilkan pesan bantuan]
    B -->|Ya| D[MediaRecorder merekam audio]
    D --> E{Stop manual, senyap, atau batas waktu?}
    E -->|Belum| D
    E -->|Ya| F[POST audio dan bahasa ke /api/transcribe]
    F --> G[Validasi format, ukuran, dan rate limit]
    G --> H{Groq Whisper berhasil?}
    H -->|Ya| I[Gunakan transkrip Groq]
    H -->|Tidak| J{Speechmatics berhasil?}
    J -->|Ya| K[Gunakan transkrip Speechmatics]
    J -->|Tidak| L[Fallback Web Speech API]
    I --> M[Grade keyword dengan exact, phonetic, dan fuzzy matching]
    K --> M
    L --> M
    M --> N[Tampilkan transkrip, keyword, skor, dan sumber]
```

Sebelum merekam, browser meminta `noiseSuppression`, `echoCancellation`, dan `autoGainControl`. Filter band-pass memakai high-pass 80 Hz dan low-pass 8 kHz. Pre-roll buffer 1.500 ms merekam audio sebelum VAD aktif agar awal ucapan tidak terpotong; dynamic VAD mengukur noise floor dan memakai hangover 800 ms untuk kata tunggal atau 2.000 ms untuk kalimat. Engine memakai locale `en-US` atau `de-DE` sesuai route. Endpoint membatasi ukuran audio hingga 10 MB dan permintaan hingga 30 per IP per menit. Setelah feedback, kuis melanjutkan pertanyaan berikutnya sesuai alur komponennya.

## Alur Leaderboard

```mermaid
flowchart TD
    A[Pengguna login] --> B[Buka /en/leaderboard atau /de/leaderboard]
    B --> C[Middleware memeriksa autentikasi]
    C --> D[Halaman SSR memanggil fetchLeaderboard]
    D --> E[Service-role client memanggil RPC get_leaderboard]
    E --> F[Agregasi profil dan total XP di Supabase]
    F --> G[Kecualikan nama/NIM berisi admin dan total XP 0]
    G --> H[Urut level DESC lalu XP DESC; batasi 100]
    H --> I[Tampilkan podium Top 3 dan list peringkat 4–100]
    I --> J[Realtime postgres_changes pada progress dan profil]
    J --> D
```

RPC didefinisikan di `supabase/leaderboard.sql`, mengecualikan nama/NIM yang mengandung `admin` tanpa membedakan kapitalisasi serta pengguna dengan XP 0, dan mengembalikan hanya ID/nama/level/XP. SQL memberi grant execute ke `anon`, `authenticated`, dan `service_role`; aplikasi memanggil RPC server-side menggunakan service-role client. Jalankan SQL tersebut pada Supabase sebelum memakai halaman leaderboard.

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
    P -->|Ya| Q[Simpan status nduniverse-goethe-level]
    Q --> R[Lulus keseluruhan]
    R --> S[Generate sertifikat PDF]
    P -->|Tidak| T[Gagal keseluruhan]
    T --> U[Tampilkan status gagal per modul dan tombol Perbaiki Skillku]
```

Timer dibatasi sesuai konfigurasi level. Hasil menunjukkan skor, rating, feedback Lesen, transkrip Hören, serta kata kunci Writing/Speaking. Semua modul wajib mencapai 60%.

## Alur TTS

```mermaid
flowchart TD
    A[Pengguna menekan tombol Speaker] --> B[Normalisasi teks dan bahasa]
    B --> C[Resolve MP3 berbasis hash atau path dari manifest statis]
    C --> D[Putar MP3 CDN]
    D --> E{Audio berhasil diputar?}
    E -->|Ya| F[Selesai]
    E -->|Tidak atau HTTP 404| G[Fallback window.speechSynthesis]
    G --> H{Web Speech API tersedia?}
    H -->|Ya| I[Bacakan dengan locale bahasa: en-US atau de-DE]
    H -->|Tidak| J[Tampilkan indikator berhenti dan log error]
```

Audio dibuat dengan Microsoft Edge TTS dan di-host di repository `nduniverse-audio`, disajikan melalui jsDelivr. TTS English UK memakai `en-GB`. Jalur pemeriksaan generator menggunakan file lokal, bukan request HTTP/HEAD ke CDN. Fallback Web Speech berlaku pada pemutar TTS shared; Boss Fight memakai player voice-line tersendiri.

## Alur Bookmark

```mermaid
flowchart LR
    A[Kuis selesai] --> B[Buka Review Kata Sulit]
    B --> C[Klik bookmark kata]
    C --> D{kata Jerman sudah ada?}
    D -->|Ya| E[Jangan duplikat]
    D -->|Belum| F[Simpan german indonesian context]
    F --> G[localStorage nduniverse-bookmarks]
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
