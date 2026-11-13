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
    P --> Q[Pengguna login]
    Q --> R[Upsert XP dan pilar lulus ke Supabase]
    R --> T[Perbarui total progress dan level]
```

Reading memakai teks dan pilihan ganda; Listening memakai audio/TTS dan pilihan ganda; Writing memakai text box fuzzy matching; Speaking memakai microphone atau text box. Anti-farming membuang XP sementara saat Game Over dan menggunakan guard finalisasi run agar XP tidak dikomit dua kali.

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

Sesi dan pilar tidak memerlukan progres sebelumnya, tidak memiliki urutan wajib, dan dapat dibuka langsung melalui URL. Kunci progres hanya menandai pasangan sesi-pilar yang telah selesai; tombol setelah kuis kembali ke materi, bukan memaksa kuis berikutnya.

## Chatbot RAG

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

## Anti-Cheat Fullscreen (NdBot)

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
    C --> E[Gabungkan progres yang telah tersimpan]
    D --> E
    E --> F[Tampilkan centang untuk pasangan yang selesai]
    F --> G[Pengguna tetap bebas memilih sesi dan pilar]
    G --> H[Jika lulus, upsert kunci sesi-pilar]
```

## Alur Career dan Boss Fight Visual Novel

```mermaid
flowchart TD
    A[User membuka /career] --> B[Pilih salah satu profesi]
    B --> C[IT atau Business atau Health atau Nutrition]
    C --> D[Buka Materi 50 kosakata dan kuis kosakata]
    D --> E[Klik Mulai Wawancara]
    E --> F[Masuk /career/profesi/boss]
    F --> G[Tampilkan layar intro ruangan kantor]
    G --> H[User klik Ketuk Pintu]
    H --> I[Animasi pintu terbuka dan Boss masuk]
    I --> J[Boss menyampaikan salam HRD]
    J --> K[User klik Mulai Wawancara]
    K --> L[Game state berubah ke interview]
    L --> M[Tampilkan pertanyaan 1 dari 10 sebagai chat HRD]
    M --> N[User menjawab melalui text box atau mic Speech API]
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

Data Career diambil dari Markdown pada `src/content/career/*.md`. Pertanyaan disimpan pada `boss_questions` dan jawaban dinilai berdasarkan `keywords` dari pertanyaan aktif. Boss Fight tidak menyimpan progress ke Supabase; badge dan hasil ditampilkan state-side di browser.

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

Lookup manifest memakai teks yang dikirim, bukan nama atau pencocokan substring. Manifest dan aset audio yang dikonfigurasi untuk CDN diambil dari jsDelivr; jika manifest atau audio gagal, browser memakai Web Speech API dengan `lang = 'de-DE'`.

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
