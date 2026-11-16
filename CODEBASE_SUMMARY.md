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

## Automated Testing & Video Promo (Playwright)

Playwright dipakai untuk menjalankan browser test, merekam video perjalanan promo, dan memeriksa interaksi/layout. Jalankan perintah dari root repository:

```powershell
# Test perjalanan promo dan rekam video
npx playwright test tests/e2e-promo.spec.ts

# Test bug hunter / pemeriksaan interaksi lintas halaman
npx playwright test tests/e2e-comprehensive.spec.ts

# Jalankan semua file test Playwright di tests/
npx playwright test
```

### Server test otomatis

Tidak perlu menjalankan `npm run dev` secara manual. `playwright.config.ts` mengatur `webServer` untuk menjalankan `npm run build` lalu `node scripts/serve-vercel-output.mjs` pada `http://localhost:4321` sebelum test. Playwright akan memakai server yang sudah berjalan di URL tersebut jika tersedia (`reuseExistingServer: true`).

### Melihat laporan dan hasil

Setelah test selesai, buka laporan HTML dengan:

```powershell
npx playwright show-report
```

Laporan menampilkan status test, langkah yang gagal, pesan error, dan tautan ke lampiran test seperti screenshot/video jika tersedia.

Artefak test disimpan sementara di `test-results/`. Test promo merekam video karena konfigurasi global mengaktifkan video; test yang menonaktifkannya secara eksplisit, seperti bug hunter, tidak menghasilkan video. Playwright membersihkan output directory saat memulai run baru, jadi salin artefak yang ingin disimpan sebelum run berikutnya. `test-results/` dan `playwright-report/` tercantum di `.gitignore`, sehingga hasil ini tidak ikut Git.

### Mengonversi video promo menjadi MP4

Jalankan test promo terlebih dahulu. Dengan FFmpeg terpasang dan tersedia di `PATH`, perintah PowerShell berikut mencari video terbaru di `test-results/`, mengonversinya ke H.264/AAC, lalu memindahkan hasilnya ke Desktop:

```powershell
$promoVideo = Get-ChildItem .\test-results -Filter video.webm -Recurse |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $promoVideo) {
  throw "video.webm tidak ditemukan. Jalankan test promo terlebih dahulu."
}

ffmpeg -i "$($promoVideo.FullName)" -c:v libx264 -preset medium -crf 18 `
  -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart `
  .\Promo_NdUniverse.mp4

Move-Item .\Promo_NdUniverse.mp4 "$env:USERPROFILE\Desktop\Promo_NdUniverse.mp4" -Force
```

Jalankan bagian ini segera setelah test promo agar yang diambil adalah video promo dan belum terhapus oleh test run baru. `-Force` mengganti file MP4 bernama sama yang sudah ada di Desktop.

### Bug report

`tests/e2e-comprehensive.spec.ts` menambahkan kegagalan langkah yang ditangkap ke `bug-report.txt` di root repository. Setiap baris berformat:

```text
[timestamp ISO] - Nama langkah - Pesan error
```

File ini adalah catatan teks untuk investigasi; laporan Playwright dan bug report memiliki tujuan berbeda.

## Cara Memanipulasi Automated Testing

### Menambah skenario atau mengubah langkah

Mulai dari `tests/e2e-promo.spec.ts` untuk alur promo/video atau `tests/e2e-comprehensive.spec.ts` untuk pemeriksaan lintas fitur. Test ditulis dengan Playwright Test dan menggunakan objek `page` untuk mengendalikan browser. Contoh:

```ts
await page.goto('/url');
await page.getByRole('button', { name: 'Teks Tombol' }).click();
await page.fill('input', 'Teks');
await page.waitForTimeout(500);
```

`page.goto()` membuka rute relatif terhadap `baseURL`. `getByRole()` memilih elemen berdasarkan peran aksesibilitas dan nama yang terlihat, sehingga biasanya lebih tahan perubahan markup. `page.fill(selector, value)` mengisi kontrol form. Untuk menunggu perubahan UI, utamakan assertion seperti `await expect(locator).toBeVisible()`; gunakan `waitForTimeout(ms)` hanya jika memang perlu jeda waktu tertentu, karena jeda tetap dapat memperlambat test dan membuatnya rapuh.

### Mengubah kecepatan dan ukuran viewport

Di `playwright.config.ts`, `use.launchOptions.slowMo` menentukan jeda (milidetik) di antara aksi browser. Konfigurasi sekarang memakai `300`; ubah, misalnya, menjadi `1000` untuk memperlambat gerakan agar lebih mudah diamati dan lebih dramatis saat direkam:

```ts
launchOptions: { slowMo: 1000 },
```

Resolusi browser/video diatur oleh `use.viewport`. Konfigurasi sekarang sudah memakai 1920 × 1080; sesuaikan nilainya bila ingin ukuran lain:

```ts
viewport: { width: 1920, height: 1080 },
```

Perubahan pada konfigurasi berlaku untuk semua test kecuali test atau fixture yang mengganti pengaturan tersebut sendiri. Setelah mengubahnya, jalankan ulang test yang terkait dan periksa video/laporan.

## Alur Hulu ke Hilir (End-to-End Flow) - Deep Dive

### 1. Chatbot NdBot

1. Pengguna mengetik di UI `src/core/ui/NdBot.jsx`, lalu menekan tombol kirim/Enter. Komponen menambahkan pesan pengguna ke state percakapan dan mengirim paling banyak 12 pesan terakhir melalui `fetch('/api/chat', { method: 'POST', ... })`.
2. `src/pages/api/chat.ts` membaca dan memvalidasi body, role, panjang pesan, dan jumlah riwayat. Permintaan yang dikenali sebagai permintaan jawaban kuis/ujian ditolak; kata kunci bantuan dapat menghasilkan tautan WhatsApp tanpa melanjutkan RAG.
3. Untuk pertanyaan materi, endpoint mencoba merapikan pertanyaan menggunakan Groq query-rewriter (memperbaiki typo, memperluas singkatan, dan menerjemahkan jika perlu). Jika rewrite gagal, endpoint memakai pertanyaan asli.
4. Pertanyaan hasil rewrite dikirim ke Cloudflare Workers AI untuk menghasilkan embedding 384 dimensi. Backend lalu memanggil Supabase RPC `match_documents` dengan embedding tersebut, ambang kemiripan, dan batas jumlah hasil. RPC mencari potongan terdekat di tabel `documents`.
5. Potongan materi yang ditemukan dimasukkan ke system prompt bersama persona dan aturan NdBot. Endpoint mengirim prompt, konteks, serta riwayat percakapan ke Groq Chat Completions; beberapa model dicoba sebagai fallback bila model sebelumnya gagal.
6. Endpoint mengembalikan objek JSON berisi `type` dan `message` (atau data tautan bantuan). `NdBot.jsx` membaca respons dan menambahkan jawaban assistant ke state untuk ditampilkan. Jika request gagal, UI menampilkan pesan gagal kirim.

Tempat perubahan: UI/state/request ada di `src/core/ui/NdBot.jsx`; validasi, prompt, Groq, Cloudflare embedding, dan pemanggilan Supabase ada di `src/pages/api/chat.ts`; fungsi RPC dan tabel ada di `supabase/setup_rag.sql`.

### 2. Kuis English dan penyimpanan progres

1. Halaman Astro mengambil item materi dari koleksi konten, lalu memberikannya ke `src/modules/english/components/Quiz-en.jsx`. Komponen membangun antrean dan menyimpan jawaban, soal aktif, XP, nyawa, dan statistik sesi di state Preact.
2. Setelah pengguna memilih/menulis jawaban lalu memeriksanya, handler kuis membandingkan jawaban dengan kunci. Untuk jawaban teks, `isFuzzyMatch()` dari `src/core/game/fuzzy-match.js` mengizinkan variasi kecil; bentuk soal lain menggunakan aturan kecocokan yang sesuai.
3. Jawaban benar memperbarui jumlah benar, XP sesi, dan antrean; jawaban salah mengurangi nyawa, mencatat soal untuk diulang, dan dapat mengakhiri sesi jika nyawa habis. Ini adalah state interaktif di browser, belum berarti setiap klik langsung ditulis ke database.
4. Saat XP/sesi memenuhi kondisi simpan (misalnya XP sesi difinalisasi atau pilar/sesi lulus), `Quiz-en.jsx` memanggil `queueProgressUpdate()`. Antrean lokal mengurutkan penulisan agar update tidak saling mendahului.
5. `src/core/db/progress-client-en.js` memakai Supabase browser client, membaca progres yang ada, menggabungkan XP dan sesi/pilar yang lulus, lalu melakukan `upsert` ke `user_progress` dengan `language_code: 'en'` dan konflik unik `user_id,material_slug,language_code`.
6. Setelah tersimpan, helper mengirim event `nd:progress-updated` agar UI yang mendengarkan dapat menyegarkan tampilan. Error penyimpanan dicatat dan ditampilkan melalui pesan toast oleh kuis.

Tempat perubahan: alur state dan pemeriksaan jawaban di `Quiz-en.jsx`; toleransi jawaban di `src/core/game/fuzzy-match.js`; pembacaan/upsert progres di `src/core/db/progress-client-en.js`; data soal di Markdown dan schema `src/content.config.ts`.

### 3. Audio TTS English

1. Tombol speaker pada kuis atau halaman materi memanggil `playAudioTTS()` dari `src/modules/english/config/english-speech.js`, dengan teks dan aksen yang dipilih (US atau UK).
2. `english-speech.js` merapikan whitespace teks dan menghentikan audio aktif sebelumnya. Untuk teks biasa, ia meminta `getSyncAudioUrl()` dari `src/core/audio/cdn-audio.js`; helper membuat SHA-256 dari teks yang dinormalisasi dan membentuk path MP3 seperti `tts-en-us/<hash>-us.mp3` atau `tts-en-gb/<hash>-gb.mp3`.
3. URL MP3 menunjuk ke repository audio di jsDelivr. `cdn-audio.js` juga menyediakan loader/resolver manifest CDN untuk path audio yang dipetakan; generator English menghasilkan manifest US/UK dan memperbarui mapping umum `manifest-cdn.json`.
4. `english-speech.js` membuat `new Audio(audioUrl)`, memuat audio, lalu memanggil `audio.play()`. Event selesai/error mengatur status tombol dan mengelola referensi audio aktif.
5. Jika audio tidak tersedia (misalnya 404), tidak ada URL TTS yang dapat dibentuk, atau browser tidak mendukung `Audio`, pemutar menggunakan `SpeechSynthesisUtterance` dengan locale `en-US` atau `en-GB`. Kegagalan jaringan/status lain dicatat sebagai error; jika browser memblokir autoplay, pengguna diminta menekan tombol lagi.

Tempat perubahan: handler playback dan fallback di `src/modules/english/config/english-speech.js`; normalisasi, hash, serta resolver CDN di `src/core/audio/cdn-audio.js`; pembuatan aset dan manifest di `scripts/generate-tts-en.py`.

## Catatan Saat Mengubah Kode

- Data Markdown harus sesuai schema koleksinya di `src/content.config.ts`; perubahan format data biasanya perlu perubahan schema dan pemakai data.
- Perubahan Supabase dapat melibatkan schema, policy/RLS, dan file SQL di `supabase/`, bukan hanya klien browser.
- Endpoint chat dan autentikasi membutuhkan variabel environment. Jangan menaruh service-role key, Groq key, atau Cloudflare token di komponen client atau repository.
- Aset audio dikirim lewat CDN terpisah. Pastikan audio dan manifest yang diterbitkan cocok dengan path/teks yang diharapkan aplikasi.
