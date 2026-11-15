# Konsep Desain Frontend

Dokumen ini merangkum prinsip visual dan perilaku antarmuka NdUniverse. Rincian implementasi bisa berubah; bagian yang belum tersedia di kode saat ini ditandai secara eksplisit.

## Filosofi Desain

- **Dark mode dengan aksen emas:** area belajar menggunakan latar biru-hitam gelap, card yang menyatu dengan latar, teks terang, dan aksen emas untuk tindakan utama maupun fokus.
- **Indonesian-first:** teks UI ditulis langsung di komponen. Tidak ada sistem i18n terpusat; beberapa komponen memiliki string varian yang ditulis hardcoded. Rute `/de` dan `/en` memilih modul pembelajaran, bukan mengganti bahasa global UI. Materi dan soal tetap menggunakan bahasa target.
- **Fokus dan keterbacaan:** warna status, kontras, spasi, serta perilaku sentuh dirancang agar belajar dan mengerjakan ujian tetap nyaman.

## Landing Page (`/`)

Landing memperkenalkan produk melalui hero dengan judul utama, deskripsi yang menjelaskan modul dan fitur belajar, lalu bagian fitur, panduan akun, dan pemilihan modul.

Hero memakai struktur heading dan deskripsi yang jelas untuk SEO. Halaman menetapkan description, canonical URL, Open Graph/Twitter metadata, alternate `hreflang`, serta `index, follow`.

Kartu pemilihan modul memakai SVG bendera dari `public/flags/gb.svg` dan `public/flags/de.svg`, bukan emoji. Rasio dan ukuran gambar ditentukan CSS agar tampil konsisten lintas browser, sistem operasi, dan perangkat. Tautan tetap menuju `/login-en` dan `/login-de`.

Panduan mulai membuat akun di halaman:

1. Pilih modul bahasa Jerman atau Inggris.
2. Buka **Masuk / Daftar**.
3. Isi username atau email dan kata sandi.
4. Akun baru dibuat otomatis saat kredensial baru digunakan; setelah masuk, pengguna dapat mulai belajar.

UI landing secara umum berbahasa Indonesia, tetapi beberapa kicker dan penanda bagian masih berbahasa Inggris. Karena tidak ada sistem lokalisasi terpusat, konsistensi copy perlu diperiksa langsung pada komponen terkait.

## Tema Gelap dan Konsistensi

Landing, portal, dashboard, halaman materi, katalog karier, dan pengalaman Boss Fight memakai tema dasar gelap dengan teks terang serta aksen emas. Halaman karier memakai token warna bersama (`--bg-dark`, `--bg-main`, `--card-bg`, `--text-main`, dan `--accent-gold`) agar kartu dan navigasi tetap selaras dengan dashboard. Boss Fight juga memakai palet gelap pada overlay cinematic, panel dialog, dan area wawancara; state hasil dapat memakai warna status khusus untuk menonjolkan kelulusan.

Gunakan token semantik dari layout yang menaungi komponen dan pertahankan kontras teks. Periksa konteks state sebelum mengganti warna status agar feedback benar/salah atau kelulusan tetap mudah dikenali.

## Portal Publik (`/de` dan `/en`)

Kedua portal adalah halaman publik untuk memilih jalur belajar bahasa. Portal DE mengarahkan ke materi German, persiapan Goethe, dan jalur karier; portal EN mengarahkan ke materi English, persiapan ujian internasional, dan jalur karier. Kartu portal menggunakan tema gelap dan aksen emas. Pengguna yang sudah masuk diarahkan ke dashboard modulnya.

## Login (`/login-de` dan `/login-en`)

Halaman login memakai form bersama dengan komposisi dua panel, tema gelap, dan aksen emas. Form menerima email atau username serta kata sandi. Pengguna baru dapat dibuat otomatis melalui form yang sama. String UI disimpan langsung di komponen; beberapa label dapat memiliki varian bahasa hardcoded, bukan dikelola oleh sistem i18n terpusat.

Rute dashboard setelah login:

- German: `/dashboard-de`
- English: `/en/dashboard`

## Dashboard German dan English

Dashboard German dan English memiliki visual gelap yang selaras: sidebar gelap, header navigasi, card materi, teks terang, dan aksen emas. Di layar kecil, navigasi dashboard berubah menjadi sidebar yang dapat dibuka dan ditutup; area konten tetap dapat digunakan.

Card katalog menampilkan nama, ringkasan, progres, dan badge CEFR:

| Level | Latar badge | Teks |
| --- | --- | --- |
| A1/A2 | Hijau `#10B981` | Gelap `#071019` |
| B1/B2 | Biru `#3B82F6` | Putih `#FFFFFF` |
| C1/C2 | Ungu `#7C3AED` | Putih `#FFFFFF` |

## Katalog dan Detail Materi

Katalog menggunakan grid card responsif dengan progres materi dan navigasi ke detail. Halaman detail menampilkan materi dan tabel kosakata. Tabel lebar ditempatkan dalam wrapper `.table-scroll` agar dapat digeser secara horizontal tanpa merusak lebar halaman.

## Cinematic Boss Fight

Boss Fight karier menyajikan adegan wawancara dalam overlay yang memenuhi viewport, dengan urutan pintu terbuka, HRD masuk, dan dialog pengantar. Dialog HRD memakai voice acting dari audio TTS; teks ditampilkan dengan typewriter yang kecepatannya diselaraskan dengan durasi audio. Jika audio tidak tersedia atau pengguna memilih reduced motion, teks tetap tampil dengan fallback yang sesuai. Pengalaman dapat digunakan pada desktop dan layar kecil; overlay ini adalah tampilan penuh di halaman, bukan permintaan browser Fullscreen API.

Setelah adegan pengantar, pengguna menjawab pertanyaan wawancara bertahap melalui teks atau Speech Recognition. Jawaban dinilai dengan pencocokan kata kunci, lalu layar hasil menampilkan status wawancara.

## Kuis, Latihan, dan Ujian

Kuis dan latihan memakai latar gelap, card soal gelap, teks terang, pilihan jawaban dengan state terpilih yang jelas, serta progress bar. Feedback benar menggunakan warna status aman/hijau dengan latar gelap; feedback salah menggunakan merah dengan latar gelap.

Kuis latihan empat pilar menampilkan progres pengerjaan dan sesi. Countdown timer digunakan pada simulasi ujian yang menetapkan durasi; jangan mengasumsikan kuis latihan biasa memiliki timer.

## NdBot (AI Assistant)

NdBot adalah karakter tutor dengan FAB dan panel percakapan. Bentuk karakter memakai animasi CSS untuk napas, kedip, dan lambai. Perilaku dikendalikan oleh tiga mode:

- `study`: chat tutor tersedia; bubble sapaan dapat muncul berkala.
- `quiz`: chat dinonaktifkan dan panel tertutup selama kuis.
- `exam`: chat dinonaktifkan; warna FAB menunjukkan tingkat strike.

**Catatan typewriter:** konsep visual bubble dapat memakai efek typewriter, tetapi implementasi saat ini mengganti teks bubble secara utuh, bukan mengetik huruf demi huruf.

Pada layar kecil, FAB diperkecil dan bubble disembunyikan agar tidak menutupi konten utama atau navigasi. Toast dibatasi terhadap lebar viewport.

## Anti-Cheat Ujian

Hook anti-cheat meminta fullscreen melalui Fullscreen API dan mengamati keluar dari fullscreen, tab yang disembunyikan, serta window yang kehilangan fokus. Pelanggaran diberi cooldown lima detik. Strike ketiga menjalankan callback force-submit ujian. NdBot tetap menampilkan indikator strike dalam mode `exam`, tetapi chat terkunci.

Kunci NdBot pada mode `quiz`/`exam` hanya membatasi chat selama sesi tersebut; hal itu berbeda dari akses memilih materi, sesi, atau pilar. Pemilihan sesi dan pilar kuis tidak dikunci berdasarkan progres sebelumnya. Fullscreen tetap bergantung pada izin dan dukungan browser.

## Panduan CSS Variables

Gunakan token semantik alih-alih mengulang warna literal pada komponen bertema dashboard:

| Variable | Penggunaan / nilai tema dashboard |
| --- | --- |
| `--bg-dark` | Latar terdalam, `#071019` |
| `--bg-main` | Latar halaman, `#0b1520` |
| `--card-bg` | Latar card, `#071019` |
| `--text-main` | Teks utama, `#f8fafc` |
| `--muted` | Teks sekunder, putih dengan opacity |
| `--accent-gold` | Aksen/tindakan utama, `#e5a93b` |
| `--primary-hover` | Aksen emas hover, `#C98D23` |
| `--border` | Border tipis berwarna emas transparan |
| `--bg-soft` | Permukaan sekunder yang dicampur dari warna tema |
| `--gold-soft` | Emas lembut untuk aksen pendukung |
| `--shadow` | Bayangan card dan panel |
| `--nd-status-safe` / `--nd-status-safe-ring` | Status aman dan ring hijau |
| `--nd-status-warning` / `--nd-status-warning-ring` | Status peringatan |
| `--nd-status-alert` / `--nd-status-alert-ring` | Status alert |
| `--nd-status-critical` / `--nd-status-critical-ring` | Status kritis/strike tertinggi |

Nilai token dapat berbeda pada layout bersama atau area legacy. Pastikan stylesheet rute yang menaungi komponen sebelum memakai token tertentu.

## Responsif dan Interaksi

- Pada breakpoint HP di bawah `768px`, grid konten yang relevan menjadi satu kolom.
- Tabel lebar memakai `.table-scroll` untuk scroll horizontal.
- Efek `:hover` hanya aktif di perangkat yang mendukung hover melalui `@media (hover: hover)`; kontrol sentuh mendapat state `:active` dan/atau `:focus-visible`.
- Sidebar dashboard dapat dibuka dan ditutup tanpa menetap menutupi konten.
- Toast dibatasi maksimal sekitar `90vw` dan ditempatkan dengan mempertimbangkan area aman viewport.
