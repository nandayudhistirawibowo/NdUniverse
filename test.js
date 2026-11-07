import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100,          // Jumlah Virtual Users (pengguna virtual)
  duration: '1m',    // Durasi pengujian (misal 1 menit dulu untuk tes awal)
  thresholds: {
    'http_req_duration': ['p(95) < 500'], // 95% request harus di bawah 500ms
    'http_req_failed': ['rate < 0.01'],    // Error harus di bawah 1%
  },
};

export default function () {
  // Ganti URL di bawah dengan website Anda (misal: https://sikantin.ndhistira.my.id)
  const res = http.get('https://example.com');
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}