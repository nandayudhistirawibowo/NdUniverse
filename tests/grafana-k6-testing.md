# Catatan Historis Pengujian NdUniverse (k6 dan security)

**Run yang dicatat:** 17 November 2026

**Status catatan:** hasil run tersebut, bukan status tes atau performa terkini.

Gunakan [panduan pengujian](../TESTING.md) untuk menjalankan suite yang tersedia.
`load-test.js` saat ini menargetkan URL production secara langsung; jangan
jalankan load test tanpa otorisasi dan koordinasi.

## A. Hasil Security Audit (Playwright)

**Total:** 29 tes  
**Status:** 26 PASS, 2 SKIP, 1 FAIL

- **PASS:** Middleware aman; celah *Auth Bypass* telah tertambal. API Chat mengembalikan `401` untuk permintaan tanpa autentikasi, dan proses logout membersihkan sesi dengan benar.
- **SKIP:** Pengujian Leaderboard dan RLS memerlukan setup tambahan.
- **FAIL:** `04-env.spec.ts` gagal saat mencoba mengambil script internal Astro (`@id/...`). Karena pemeriksaan bundle tidak selesai, hasil ini tidak membuktikan ada ataupun tidak adanya kebocoran; evaluasi pemilihan script sebelum mengulang tes.

## B. Hasil Load Testing (Grafana k6)

**Skenario:** 100 Virtual Users (VUs) selama 1 menit  
**Total request:** 2.116

| Metrik | Hasil | Status |
|---|---:|---|
| `http_req_failed` | **0,00%** (100% sukses) | LULUS |
| `http_req_duration` — rata-rata | 2,05 s | — |
| `http_req_duration` — median | 1,03 s | — |
| `http_req_duration` — p(95) | **4,81 s** | GAGAL (ambang batas < 500 ms) |

Tidak ada request yang gagal pada run yang dicatat, tetapi ambang p95 tidak tercapai. Catatan ini tidak cukup untuk menentukan penyebab latensi; ukur ulang pada environment dan kondisi jaringan yang terkendali sebelum menarik kesimpulan.

## C. Optimasi yang Dilakukan

- Optimasi yang dicatat saat itu: SSG untuk Landing, Portal DE/EN, dan Login; lazy-load NdBot dengan `client:idle`; audio melalui CDN jsDelivr.
- Verifikasi ulang konfigurasi dan hasil build saat ini sebelum menganggap semua optimasi tersebut masih berlaku.

## D. Follow-up yang tercatat saat run tersebut

Status di bawah tidak diperiksa ulang dalam run historis ini; cocokkan dengan source dan kebutuhan saat ini sebelum menganggapnya masih terbuka.

- [ ] Memperbaiki test Env (`04-env.spec.ts`) dengan memfilter URL `@id`.
- [ ] Melakukan *lazy-load* `html2pdf.js` (913 KB).
- [ ] Membuat Leaderboard per Level.
- [ ] Menyiapkan 2 user dummy untuk pengujian RLS.
