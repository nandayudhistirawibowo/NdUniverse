# siDeutsch — Entity Relationship Diagram

## Entitas Utama

```mermaid
erDiagram
    AUTH_USERS ||--o| PROFILES : "memiliki profil"
    AUTH_USERS ||--o{ USER_PROGRESS : "memiliki progress"

    AUTH_USERS {
        uuid id PK
        text email
        jsonb raw_user_meta_data
        timestamptz created_at
    }

    PROFILES {
        uuid id PK, FK
        text nim "nullable"
        text nama_lengkap
        text nomor_wa
        text avatar_url "path objek Private Storage"
    }

    USER_PROGRESS {
        uuid id PK
        uuid user_id FK
        text material_slug
        integer xp
        jsonb sessions_passed
        text notes
        timestamptz updated_at
    }
```

## Tabel Database

| Tabel | Kolom yang digunakan aplikasi | Constraint / catatan |
| --- | --- | --- |
| `auth.users` | `id`, `email`, `raw_user_meta_data`, `created_at` | Dikelola Supabase Auth. Login menerima email atau NIM lama yang dinormalisasi ke email akun. |
| `public.profiles` | `id`, `nim`, `nama_lengkap`, `nomor_wa`, `avatar_url` | `id` sama dengan `auth.users.id`. `nim` bersifat **nullable** karena pengguna email umum tidak selalu memiliki NIM. `avatar_url` menyimpan path objek, bukan URL publik. |
| `public.user_progress` | `id`, `user_id`, `material_slug`, `xp`, `sessions_passed`, `notes`, `updated_at` | Kombinasi `(user_id, material_slug)` unik; `sessions_passed` harus JSON array melalui check JSONB; `xp` tidak boleh negatif; RLS membatasi akses ke pemilik baris. |

## Relasi dan Makna Kolom

- Satu pengguna Supabase memiliki nol atau satu profil.
- Satu pengguna dapat memiliki banyak baris progress, satu baris per `material_slug`.
- `material_slug` mengacu logis ke ID Astro Content Collection dan bukan foreign key SQL.
- `xp` menyimpan progres XP kumulatif yang sudah dikomit.
- `notes` menyimpan catatan belajar pengguna untuk materi tertentu.
- `updated_at` diperbarui setiap upsert progress.
- Level dashboard tidak berasal dari satu kolom database; dihitung dari material CEFR yang telah menyelesaikan keempat pilar.

## Format `sessions_passed`

Kolom JSONB mendukung dua format:

- Format baru: `['reading', 'listening', 'writing', 'speaking']`
- Format lama: `[1, 2, 3, 4]`

Data lama wajib dinormalisasi saat dibaca menjadi nama pilar. Data lama lengkap `[1, 2, 3, 4]` diperlakukan sebagai keempat pilar lulus. Saat upsert, array yang dikirim dapat berupa string pilar JSONB yang kompatibel dengan PostgreSQL/Supabase tanpa mengubah tipe kolom.

Materi baru dianggap lulus hanya jika keempat pilar ada setelah normalisasi. Materi Fachdeutsch dan Career tidak dihitung sebagai poin level CEFR meskipun progress pilar tersimpan.

## Data di Luar Database

- Konten materi dan vocab disimpan dalam Markdown/Astro Content Collections, bukan tabel SQL.
- Konten Career disimpan di `src/content/career/*.md` dan diambil melalui koleksi Astro `career`, bukan Supabase.
- Setiap file Career berisi **50 entri `vocab`** dengan `german`, `indonesian`, dan `context`, serta **10 entri `boss_questions`**.
- Setiap `boss_questions` berisi satu `question` berbahasa Jerman dan array `keywords` 2–3 kata kunci untuk penilaian wawancara.
- Bookmark kosakata disimpan di browser pada `localStorage` key `sideutsch-bookmarks` dan tidak disinkronkan ke Supabase.
- Status kelulusan Mock Exam disimpan pada `localStorage` key `sideutsch-ujian-[level]`.
- Status kelulusan Simulasi Goethe disimpan pada `localStorage` key `sideutsch-goethe-[level]`.
- **Sertifikat PDF adalah artefak client-side** yang dibuat melalui `html2pdf.js`; sertifikat tidak disimpan sebagai entitas atau blob database.
- Avatar disimpan di bucket Private `avatars` pada Supabase Storage. Aplikasi membuat Signed URL untuk ditampilkan. Bookmark dan sertifikat tidak memiliki tabel SQL.
- Manifest dan file Audio TTS berjumlah 8.372 MP3 disimpan sebagai aset statis pada `public/audio/tts/`.

## RLS dan Keamanan

`user_progress` mengaktifkan Row Level Security. Pengguna hanya dapat membaca dan mengubah baris milik `auth.uid()` melalui kebijakan select, insert, dan update. Bucket avatar bersifat Private; akses file memerlukan pemeriksaan kepemilikan/admin dan Signed URL.
