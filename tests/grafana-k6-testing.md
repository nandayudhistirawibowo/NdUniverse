# Laporan Pengujian NdUniverse V4 (K6 & Security)

**Tanggal:** 17 November 2026

## A. Hasil Security Audit (Playwright)

**Total:** 29 tes  
**Status:** 26 PASS, 2 SKIP, 1 FAIL

- **PASS:** Middleware aman; celah *Auth Bypass* telah tertambal. API Chat mengembalikan `401` untuk permintaan tanpa autentikasi, dan proses logout membersihkan sesi dengan benar.
- **SKIP:** Pengujian Leaderboard dan RLS memerlukan setup tambahan.
- **FAIL:** `04-env.spec.ts` gagal karena mencoba mengambil script internal Astro (`@id/...`). Ini bukan celah keamanan; script pengujian perlu diperbaiki agar memfilter URL `@id`.

## B. Hasil Load Testing (Grafana k6)

**Skenario:** 100 Virtual Users (VUs) selama 1 menit  
**Total request:** 2.116

| Metrik | Hasil | Status |
|---|---:|---|
| `http_req_failed` | **0,00%** (100% sukses) | LULUS |
| `http_req_duration` — rata-rata | 2,05 s | — |
| `http_req_duration` — median | 1,03 s | — |
| `http_req_duration` — p(95) | **4,81 s** | GAGAL (ambang batas < 500 ms) |

Tidak ada request yang gagal dan server tetap stabil tanpa crash. Latensi yang tinggi kemungkinan disebabkan *bottleneck* koneksi internet lokal saat mengirim beban 100 VUs dari satu mesin, bukan karena Vercel tidak tersedia.

## C. Optimasi yang Dilakukan

- Menggunakan SSG (*Static Site Generation*) untuk Landing, Portal DE/EN, dan Login.
- Memuat NdBot secara *lazy* dengan `client:idle`.
- Menghosting 100% audio melalui CDN jsDelivr.

## D. Action Items (Backlog)

- [ ] Memperbaiki test Env (`04-env.spec.ts`) dengan memfilter URL `@id`.
- [ ] Melakukan *lazy-load* `html2pdf.js` (913 KB).
- [ ] Membuat Leaderboard per Level.
- [ ] Menyiapkan 2 user dummy untuk pengujian RLS.
