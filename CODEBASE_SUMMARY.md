# Peta Kode NdUniverse

Dokumen ini adalah panduan awal untuk memahami struktur dan alur fitur utama NdUniverse. NdUniverse adalah aplikasi belajar bahasa Inggris dan Jerman berbasis Astro; halaman dan konten dirakit dari berkas Astro, koleksi Markdown, serta komponen interaktif Preact.

## Gambaran Arsitektur

Secara umum, alurnya seperti ini:

1. `src/pages/` menentukan URL dan mengambil data halaman.
2. Halaman membaca materi dari koleksi di `src/modules/` atau berinteraksi dengan layanan yang diperlukan.
3. Halaman merender layout dan komponen bersama dari `src/core/`.
4. Komponen browser menangani interaksi; layanan seperti Supabase, Groq, Cloudflare AI, dan CDN audio diakses melalui klien atau endpoint server.

Astro menggunakan routing berbasis berkas. Contohnya, `src/pages/en/materi/[slug].astro` adalah halaman materi English untuk nilai `slug` tertentu.

## Struktur Folder

### `src/core/` — kode lintas fitur

Bagian yang digunakan bersama oleh modul English dan German:

- `src/core/auth/`: portal login, middleware autentikasi/otorisasi, pemeriksaan admin, dan avatar.
- `src/core/db/`: klien browser dan fungsi untuk membaca serta menyimpan progres Supabase. File English dan German dipisah agar progres memiliki `language_code` yang sesuai.
- `src/core/game/`: utilitas game/ujian, seperti penilaian, pencocokan jawaban yang toleran terhadap typo, suara kuis, dan anti-cheat ujian.
- `src/core/audio/`: pemetaan URL audio CDN dan pemutar voice acting Boss Fight.
- `src/core/ui/`: layout dan komponen bersama, termasuk dashboard, NdBot, hint, dan modal.
- `src/core/i18n/`: data/teks yang dipakai lintas bahasa. Ini bukan berarti seluruh UI memakai sistem i18n; antarmuka utama tetap banyak menggunakan Bahasa Indonesia.

### `src/modules/english/` — fitur dan materi English

- `content/`: materi Markdown. Isinya mencakup English sehari-hari per level CEFR, materi akademik, karier, serta soal IELTS/TOEFL.
- `components/`: komponen interaktif seperti `Quiz-en.jsx`, `CareerQuiz-en.jsx`, `BossFight-en.jsx`, dan komponen ujian.
- `config/english-speech.js`: pemutaran audio/TTS English dan fallback suara browser.

### `src/modules/german/` — fitur dan materi German

- `content/`: materi Markdown German, termasuk Alltagsdeutsch, Fachdeutsch, karier, dan materi terkait.
- `components/`: kuis, latihan karier, Goethe/mock exam, Boss Fight, dan komponen terkait pengucapan.
- `config/german-speech.js`: pemetaan dan pemutaran TTS German.

Struktur kedua modul sengaja serupa, tetapi bentuk data dan beberapa perilaku khusus bahasanya berbeda.

### `src/pages/` — URL, komposisi halaman, dan endpoint

Astro membuat rute dari struktur berkas:

- `src/pages/index.astro`, `src/pages/login-en.astro`, `src/pages/login-de.astro`, dan `src/pages/dashboard.astro`: halaman root dan autentikasi/dashboard tingkat atas.
- `src/pages/en/` dan `src/pages/de/`: katalog materi, halaman belajar, latihan, ujian, karier, dan dashboard menurut modul.
- `src/pages/api/`: endpoint server. `src/pages/api/chat.ts` adalah endpoint NdBot.
- `src/pages/logout.ts`: endpoint untuk mengakhiri sesi.
- `src/pages/admin/`: halaman administrasi.
- Nama dengan `[slug]`, `[level]`, atau `[profesi]` adalah rute dinamis; nilai kurung siku berasal dari URL.

### `scripts/` — alat pemeliharaan dan pembuatan data

Script di sini bukan bagian dari permintaan halaman pengguna secara langsung. Script membantu menghasilkan konten/ audio, mengindeks materi, dan menjalankan atau menyiapkan deploy:

- `generate-english-materi.py`, `generate-english-career.py`, `generate-english-academic-career.py`, `generate-exam-content.py`: generator materi/soal.
- `generate-tts-en.py`, `generate-tts.py`, `generate-tts.mjs`, `generate-boss-tts.py`: generator TTS/voice acting.
- `ingest-rag.py`: memasukkan konten ke indeks RAG Supabase.
- `migrate-audio-cdn.py`, `stitch-exam-audio.py`: pembantu pengelolaan aset dan manifest audio.
- `serve-vercel-output.mjs`: menyajikan output build Vercel secara lokal.

Lihat `package.json` dan `README.md` untuk perintah proyek dan langkah operasional generator.

### `public/` — aset statis

Berkas di sini disajikan langsung dari URL publik tanpa melalui komponen Astro. Contohnya logo, favicon, SVG bendera, `robots.txt`, dan audio statis yang ada di repository. `public/manifest-boss.json` memetakan dialog Boss Fight ke URL audio; `manifest-cdn.json` di root repository memetakan path audio umum ke URL CDN. Folder audio yang sangat besar/penuh aset berada di repository CDN terpisah, jadi tidak semua MP3 harus ada lokal.

## Alur Data Hulu ke Hilir

### Login dan autentikasi

1. Pengguna membuka `src/pages/login-en.astro` atau `src/pages/login-de.astro`. Keduanya menggunakan tampilan dan logika bersama dari `src/core/auth/AuthPortal.astro`.
2. `AuthPortal.astro` membuat klien browser Supabase (`@supabase/ssr`). Form menerima email atau username; username diubah menjadi alamat email internal. Pengguna yang belum punya akun dapat dibuat lewat `supabase.auth.signUp`, kemudian portal mencoba masuk dengan `signInWithPassword`. Profil mahasiswa disimpan/diperbarui di tabel `profiles`.
3. `src/middleware.ts` meneruskan request ke `src/core/auth/middleware.ts`. Middleware membuat klien Supabase server dari cookie, memeriksa pengguna lewat `auth.getUser()`, lalu mengisi `Astro.locals.user`, `profile`, dan klien Supabase.
4. Middleware mengarahkan pengguna yang belum masuk dari rute terlindungi ke halaman login. Untuk rute admin, middleware juga memeriksa NIM admin lewat `src/core/auth/admin.ts`.
5. `src/pages/logout.ts` mengakhiri sesi melalui `auth.signOut()`.

Variabel publik Supabase dipakai di browser/server; kunci service role hanya untuk pekerjaan server yang memang membutuhkannya dan tidak boleh dimasukkan ke kode browser.

### Kuis, latihan, state, timer, dan penilaian

1. Halaman latihan Astro, misalnya `src/pages/en/materi/latihan.astro` atau `src/pages/de/materi/[slug]/latihan.astro`, mengambil materi dan meneruskannya sebagai props ke komponen Preact.
2. `src/modules/english/components/Quiz-en.jsx` dan `src/modules/german/components/Quiz-de.jsx` menangani state latihan: antrean soal, indeks, jawaban, benar/salah, nyawa, XP, bookmark, dan progres sesi/pilar. Keduanya memeriksa jawaban pilihan/pasangan dan memakai `src/core/game/fuzzy-match.js` untuk jawaban teks yang boleh memiliki perbedaan kecil.
3. Kuis kosakata biasa **tidak memakai countdown ujian**. Timer countdown berada pada komponen ujian: misalnya `EnglishExam-en.jsx`, `IELTSExam-en.jsx`, `GoetheExam-de.jsx`, dan komponen mock exam sesuai rute. State dan interval timer ada di komponen-komponen JSX tersebut.
4. Ujian English mengimpor fungsi di `src/core/game/exam-grading.js` untuk menghitung skor modul, status lulus, dan menyimpan hasil. Goethe juga memakai utilitas itu; beberapa ujian lain memiliki logika grading di komponen ujiannya.
5. Progres latihan dikirim melalui `src/core/db/progress-client-en.js` atau `src/core/db/progress-client.js` ke tabel `user_progress` di Supabase. Prefix/properti bahasa memisahkan progres English (`en`) dan German (`de`).
6. Soal ujian dan latihan bersumber dari koleksi Markdown yang didefinisikan dan divalidasi di `src/content.config.ts`. Untuk menambah soal, periksa format koleksi dan data Markdown yang sesuai, bukan hanya JSX.

### NdBot — UI, retrieval Supabase, lalu jawaban Groq

1. UI utama NdBot berada di `src/core/ui/NdBot.jsx`. Komponen ini mengelola percakapan dan mengirim pesan ke `POST /api/chat`. NdBot juga dipasang di layout/dashboard serta kuis/ujian dengan mode yang berbeda.
2. Endpoint `src/pages/api/chat.ts` memvalidasi ukuran dan format pesan, membatasi riwayat, dan menolak permintaan yang terdeteksi meminta jawaban kuis/ujian. Permintaan bantuan tertentu dapat diarahkan ke WhatsApp.
3. Untuk retrieval RAG, pertanyaan dapat dirapikan oleh model Groq query-rewriter, lalu diubah menjadi embedding 384 dimensi oleh Cloudflare Workers AI (`bge-small-en-v1.5`).
4. Endpoint memanggil fungsi Supabase `match_documents` melalui klien service role. Fungsi SQL ini mencari potongan terdekat di tabel `documents` menggunakan vector similarity; definisi tabel dan RPC ada di `supabase/setup_rag.sql`. Proses ingest konten dijalankan lewat `scripts/ingest-rag.py`.
5. Potongan materi yang ditemukan ditambahkan sebagai konteks system prompt. Endpoint mengirim riwayat dan konteks ke Groq Chat Completions, mencoba beberapa model cadangan, lalu mengirim jawaban ke UI.
6. Prompt persona, aturan jawaban, filter soal, dan prompt perapihan query berada di bagian atas `src/pages/api/chat.ts`. Ubah bagian tersebut bila ingin menyesuaikan perilaku/prompt AI.

### Audio TTS English

1. Saat generator dijalankan, `scripts/generate-tts-en.py` menghasilkan audio English untuk aksen US dan UK, manifest aksen (`manifest-en-us.json` / `manifest-en-gb.json`), dan memperbarui `manifest-cdn.json`. Manifest aksen dapat tersedia bersama aset di CDN; beberapa file manifest juga ada di `public/audio/`.
2. `src/core/audio/cdn-audio.js` menyediakan utilitas shared untuk memuat peta path-ke-URL dari `manifest-cdn.json`, menyelesaikan path audio, dan membuat URL TTS English dari hash teks yang dinormalisasi plus kode aksen.
3. `src/modules/english/config/english-speech.js` adalah API pemutaran yang dipakai kuis, halaman materi, grammar, dan pronunciation. `playAudioTTS()` memilih aksen, mencoba MP3 dari CDN, dan mengelola pemutaran aktif. Jika audio tidak tersedia (misalnya respons 404), atau browser tidak mendukung pemutar audio, fungsi beralih ke `SpeechSynthesisUtterance`. Kegagalan jaringan/status lain dicatat sebagai error; pemutaran yang diblokir browser meminta pengguna mencoba lagi.
4. Audio statis/URL langsung juga dapat diteruskan ke pemutar. Jadi untuk mengubah perilaku fallback atau playback, mulai dari `english-speech.js`; untuk mengubah pembuatan URL dan resolver bersama, lihat `cdn-audio.js`; untuk menghasilkan ulang audio, lihat script generator dan petunjuk di `README.md`.

### Boss Fight — cinematic, voice acting, dan typewriter

1. Rute `src/pages/en/career/[profesi]/boss.astro` dan `src/pages/de/career/[profesi]/boss.astro` mengambil data karier lalu meneruskannya ke `BossFight-en.jsx` atau `BossFight-de.jsx`.
2. Data pembuka (`boss_intro`) dan daftar pertanyaan/kata kunci (`boss_questions`) ditulis di konten karier Markdown. `src/content.config.ts` memvalidasi bentuk data English dan German.
3. Komponen Boss Fight mengatur state cinematic, urutan dialog, pertanyaan wawancara, jawaban, dan hasil. Chat bubble memanggil `playBossAudio()` dari `src/core/audio/boss-audio.js`.
4. `boss-audio.js` membaca `public/manifest-boss.json`, mencari audio berdasarkan teks dialog dan bahasa, lalu memutar URL CDN. Audio dialog diserialkan agar satu voice line berjalan pada satu waktu.
5. Typewriter menampilkan teks bertahap. Jika audio tersedia, interval per karakter disesuaikan dengan durasi audio dan penyelesaian teks menunggu audio; jika audio tak tersedia/gagal, typewriter memakai kecepatan default.
6. Pertanyaan dan kata kunci menentukan evaluasi jawaban serta syarat penyelesaian. Untuk mengubah narasi/soal suatu karier, ubah Markdown profesinya; untuk mengubah tampilan dan state cinematic, ubah komponen Boss Fight; untuk mapping audio, generator, atau pemutar voice acting, lihat manifest, script TTS, dan `boss-audio.js`.

## Panduan Navigasi Developer

- **Mau mengubah desain UI dashboard?** Mulai dari `src/core/ui/DashboardLayout-en.astro` atau `DashboardLayout-de.astro` untuk layout modul; halaman data dashboard ada di `src/pages/en/dashboard/` dan `src/pages/dashboard-de/`. Jika yang dimaksud dashboard root, lihat `src/pages/dashboard.astro`.
- **Mau mengubah navigasi/header/footer yang dipakai lintas halaman?** Lihat `src/core/ui/Layout.astro`.
- **Mau menambah atau mengubah materi kosakata?** Edit Markdown di `src/modules/english/content/` atau `src/modules/german/content/`, lalu cocokkan formatnya dengan koleksi dalam `src/content.config.ts`.
- **Mau menambah soal kuis materi?** Tambahkan entri vocab beserta field latihan yang diperlukan di berkas Markdown materi yang sesuai; latihan dirender oleh `Quiz-en.jsx` atau `Quiz-de.jsx`.
- **Mau mengubah perilaku state atau penilaian latihan?** Lihat `src/modules/english/components/Quiz-en.jsx` atau `src/modules/german/components/Quiz-de.jsx`; pencocokan fuzzy bersama berada di `src/core/game/fuzzy-match.js`.
- **Mau mengubah soal IELTS/TOEFL atau Goethe?** English: materi di `src/modules/english/content/exam/` dan komponen `EnglishExam-en.jsx` / `IELTSExam-en.jsx`; German: data dan rute Goethe di area `src/pages/de/ujian/goethe/` dan `GoetheExam-de.jsx`.
- **Mau mengubah timer, aturan lulus, atau skor ujian?** Lihat komponen ujian yang sesuai dan `src/core/game/exam-grading.js`. Timer biasanya berada di komponen ujian, bukan pada kuis kosakata.
- **Mau mengubah tampilan/login?** Rute di `src/pages/login-en.astro` / `login-de.astro`; UI dan alur sign-in/sign-up bersama di `src/core/auth/AuthPortal.astro`.
- **Mau mengubah proteksi dashboard/admin?** Lihat `src/core/auth/middleware.ts` (dipasang oleh `src/middleware.ts`) dan `src/core/auth/admin.ts`.
- **Mau mengubah penyimpanan progres?** Gunakan `src/core/db/progress-client-en.js` atau `progress-client.js`; perubahan skema tabel terkait juga perlu ditinjau di `supabase/`.
- **Mau mengubah prompt atau perilaku NdBot?** Buka `src/pages/api/chat.ts`. Untuk tampilan chat, buka `src/core/ui/NdBot.jsx`.
- **Mau mengubah retrieval RAG atau cara materi diindeks?** Endpoint/RPC ada di `src/pages/api/chat.ts` dan `supabase/setup_rag.sql`; proses memasukkan materi ada di `scripts/ingest-rag.py`.
- **Mau mengubah aksen, playback, atau fallback TTS English?** Buka `src/modules/english/config/english-speech.js`; URL/hash dan resolver CDN ada di `src/core/audio/cdn-audio.js`.
- **Mau menghasilkan ulang audio English/Boss Fight?** Lihat `scripts/generate-tts-en.py` atau `scripts/generate-boss-tts.py`, lalu ikuti aturan publikasi audio/manifest di `README.md`.
- **Mau mengubah adegan Boss Fight?** Ubah `BossFight-en.jsx` / `BossFight-de.jsx` untuk UI dan state, atau Markdown profesi untuk intro/pertanyaan/kata kunci. Voice acting memakai `src/core/audio/boss-audio.js` dan `public/manifest-boss.json`.
- **Mau menambah rute/halaman?** Buat atau ubah berkas Astro di lokasi yang mencerminkan URL dalam `src/pages/`; gunakan `[parameter]` untuk rute dinamis.

## Catatan Saat Mengubah Kode

- Data Markdown harus sesuai schema koleksinya di `src/content.config.ts`; perubahan format data biasanya perlu perubahan schema dan pemakai data.
- Perubahan Supabase dapat melibatkan schema, policy/RLS, dan file SQL di `supabase/`, bukan hanya klien browser.
- Endpoint chat dan autentikasi membutuhkan variabel environment. Jangan menaruh service-role key, Groq key, atau Cloudflare token di komponen client atau repository.
- Aset audio dikirim lewat CDN terpisah. Pastikan audio dan manifest yang diterbitkan cocok dengan path/teks yang diharapkan aplikasi.
