import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100,          // 100 Virtual Users
  duration: '1m',    // Durasi 1 menit (coba dulu, nanti bisa dinaikin)
  thresholds: {
    // 95% request harus di bawah 500ms (Vercel Edge biasanya jauh lebih cepat dari ini)
    'http_req_duration': ['p(95) < 500'], 
    // Error rate harus di bawah 1%
    'http_req_failed': ['rate < 0.01'],    
  },
};

export default function () {
  // 1. Tes Landing Page
  const resLanding = http.get('https://nduniverse.ndhistira.my.id');
  check(resLanding, {
    'Landing page status is 200': (r) => r.status === 200,
  });
  sleep(1);

  // 2. Tes Portal Jerman (DE)
  const resDE = http.get('https://nduniverse.ndhistira.my.id/de');
  check(resDE, {
    'Portal DE status is 200': (r) => r.status === 200,
  });
  sleep(1);

  // 3. Tes Portal Inggris (EN)
  const resEN = http.get('https://nduniverse.ndhistira.my.id/en');
  check(resEN, {
    'Portal EN status is 200': (r) => r.status === 200,
  });
  sleep(1);

  // 4. Tes Halaman Login (Tampilan publik, nggak butuh auth)
  const resLogin = http.get('https://nduniverse.ndhistira.my.id/login-en');
  check(resLogin, {
    'Login page status is 200': (r) => r.status === 200,
  });
  
  sleep(1); // Jeda antar iterasi (biar kayak user beneran)
}