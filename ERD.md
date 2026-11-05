# siDeutsch — Entity Relationship Diagram

## Diagram

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
        text nim
        text nama_lengkap
        text nomor_wa
        text avatar_url
        text current_level
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

## Tabel dan Relasi

| Tabel | Kolom yang digunakan aplikasi | Constraint / catatan |
| --- | --- | --- |
| `auth.users` | `id`, `email`, `raw_user_meta_data`, `created_at` | Tabel yang dikelola Supabase Auth. NIM mahasiswa dipakai untuk membentuk email login sintetis. |
| `public.profiles` | `id`, `nim`, `nama_lengkap`, `nomor_wa`, `avatar_url`, `current_level` | Kode mengakses profil dengan `id = auth.users.id` dan melakukan upsert berdasarkan `id`, sehingga relasinya dimaksudkan 1:1. Definisi lengkap tabel profil tidak disimpan dalam repo ini. `current_level` pernah ditambahkan dengan migrasi, tetapi tidak dipakai untuk menentukan level dashboard saat ini. |
| `public.user_progress` | `id`, `user_id`, `material_slug`, `xp`, `sessions_passed`, `notes`, `updated_at` | UUID primary key; `user_id` mereferensikan `auth.users(id)` dengan `ON DELETE CASCADE`; pasangan `(user_id, material_slug)` unik. RLS membatasi akses user ke baris miliknya. |

### Kardinalitas

- Satu `auth.users` memiliki nol atau satu baris `profiles`; profil diidentifikasi dengan UUID auth yang sama. FK profil perlu dikonfirmasi pada schema Supabase aktual karena DDL lengkap `profiles` tidak tersedia di repo.
- Satu `auth.users` dapat memiliki banyak baris `user_progress` (satu per materi yang dipelajari).
- Constraint unik `(user_id, material_slug)` menjaga maksimal satu progress per materi untuk setiap user.
- `material_slug` mengacu secara logis ke ID di Astro Content Collection `materi`, bukan ke tabel relasional Supabase.

### Bentuk Data Progress

- `xp`: XP yang didapat pada materi tersebut.
- `sessions_passed`: JSONB array nomor sesi, misalnya `[1, 2]`.
- `notes`: catatan belajar user untuk materi tersebut.
- `updated_at`: diisi helper upsert setiap perubahan.

Level dashboard dihitung dari `sessions_passed` dan metadata CEFR materi di collection; kolom `profiles.current_level` tidak menjadi sumber level dinamis.
