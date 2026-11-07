# siDeutsch — Entity Relationship Diagram

## Entitas Relasional

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
        text avatar_url "path objek Storage"
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

*Fitur Bookmark dan antrean TTS tidak disimpan di database, melainkan di localStorage (Bookmark) dan public/audio (File Statis).*

## Tabel

| Tabel | Kolom yang digunakan aplikasi | Constraint / catatan |
| --- | --- | --- |
| `auth.users` | `id`, `email`, `raw_user_meta_data`, `created_at` | Dikelola Supabase Auth. Pengguna masuk dengan email atau NIM lama yang dipetakan ke alamat `NIM@student.sideutsch.com`; pengguna baru dapat dibuat lewat auto-signup. |
| `public.profiles` | `id`, `nim`, `nama_lengkap`, `nomor_wa`, `avatar_url` | Aplikasi menggunakan `id` yang sama dengan `auth.users.id`. Kolom `nim` **nullable** (`NULL` diperbolehkan) untuk pengguna umum tanpa NIM. `avatar_url` menyimpan path objek di bucket Storage, bukan URL publik. Terapkan `supabase/profiles_nim_nullable.sql` pada database yang kolomnya masih `NOT NULL`. Definisi lengkap tabel profiles tidak tersedia di repo; cocokkan constraint lain dengan Supabase aktual. |
| `public.user_progress` | `id`, `user_id`, `material_slug`, `xp`, `sessions_passed`, `notes`, `updated_at` | Didefinisikan di `supabase/user_progress.sql`; `(user_id, material_slug)` unik, `user_id` FK ke `auth.users(id)` dengan cascade delete, dan RLS membatasi akses ke baris milik pengguna. `xp` bernilai non-negatif; `sessions_passed` berupa array JSONB. |

## Relasi dan Makna Data

- Satu `auth.users` memiliki nol atau satu profil dengan UUID yang sama; detail constraint foreign key `profiles` perlu dicocokkan dengan Supabase karena DDL lengkap tabel tersebut tidak ada di repo.
- Satu pengguna dapat memiliki banyak baris `user_progress`, satu per slug materi.
- `material_slug` mengacu secara logis pada ID content collection Astro; ia bukan FK ke tabel materi PostgreSQL.
- `xp` adalah nilai kumulatif per materi yang disimpan setelah kuis selesai.
- `sessions_passed` adalah array JSONB nomor sesi yang lulus, misalnya `[1, 2]`.
- `notes` menyimpan catatan belajar per materi dan `updated_at` diperbarui saat upsert.
- Level dashboard dihitung dari sesi lulus dan metadata level CEFR di materi, bukan dari kolom database `current_level`.
- `supabase/profile_current_level.sql` menambahkan kolom legacy `profiles.current_level`; level dashboard saat ini tidak membacanya.

## Data di Luar ERD

- Materi Alltagsdeutsch dan Fachdeutsch berada di `src/content/materi/`; track Career berada di `src/content/career/`. Vocab dan konteks disimpan sebagai Markdown.
- Bookmark memuat `german`, `indonesian`, dan `context` di `localStorage` dengan key `sideutsch-bookmarks`. Bookmark bersifat client-side per browser, tidak disinkronkan dengan Supabase, dan tidak memiliki relasi SQL.
- Audio TTS terdiri dari 8.372 file MP3 statis di `public/audio/tts/`, dengan `manifest.json` untuk pemetaan teks ke file audio. File serta pemetaan tersebut tidak disimpan di database.
- Avatar disimpan di bucket Supabase Storage `avatars` yang **Private**. `profiles.avatar_url` menyimpan path objek; foto dirender melalui *Signed URL* yang berlaku selama 1 jam. Metadata objek Storage tidak dimodelkan sebagai tabel relasional aplikasi.
