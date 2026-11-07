# Laporan Pengujian k6

## Konfigurasi

Pengujian dijalankan dengan perintah:

```powershell
k6 run test.js
```

Konfigurasi skenario pada `test.js`:

- **Virtual Users:** 100 pengguna virtual
- **Durasi:** 1 menit
- **Waktu ramp-down:** 30 detik
- **Total request:** 5.850

## Hasil Pengujian

Status keseluruhan: **LULUS**

| Metrik | Hasil | Kriteria | Status |
|---|---:|---:|---|
| `http_req_duration` p95 | 32,69 ms | `< 500 ms` | Lulus |
| `http_req_failed` | 0,00% | `< 1%` | Lulus |
| `checks_succeeded` | 100% | 5.850/5.850 | Lulus |
| `http_reqs` | 5.850 request | - | Selesai |
| Throughput | 95,87 request/detik | - | - |

## Detail Performa

- **HTTP request duration rata-rata:** 26,62 ms
- **HTTP request duration minimum:** 18,87 ms
- **HTTP request duration median:** 23,68 ms
- **HTTP request duration maksimum:** 433,15 ms
- **p90:** 29,33 ms
- **p95:** 32,69 ms
- **HTTP request gagal:** 0%
- **Durasi rata-rata iterasi:** 1,03 detik
- **Iteration selesai:** 5.850
- **Iteration terganggu:** 0

## Validasi

- `status is 200`: 5.850 pemeriksaan berhasil
- 5.850 pemeriksaan berhasil dan 0 pemeriksaan gagal
- Tidak ada request timeout atau kegagalan HTTP
- Sistem mampu menangani kenaikan hingga 100 Virtual Users selama skenario pengujian

## Kesimpulan

Pengujian k6 berhasil dan seluruh threshold terpenuhi. Website memproses semua request dalam kondisi load 100 Virtual Users dengan tingkat kegagalan 0% dan latensi p95 sebesar 32,69 ms, jauh di bawah batas 500 ms.
