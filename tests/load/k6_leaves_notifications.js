import http from 'k6/http';
import { sleep, check } from 'k6';

// Usage example:
// k6 run -e BASE_URL="http://localhost:8000" -e API_KEY="<key>" tests/load/k6_leaves_notifications.js

export const options = {
  vus: 100,
  duration: '60s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const API_KEY = __ENV.API_KEY || 'change_me';

function apiGet(path) {
  return http.get(`${BASE_URL}${path}`, {
    headers: {
      'X-API-KEY': API_KEY,
      'Content-Type': 'application/json',
    },
    tags: { name: path },
  });
}

export default function () {
  // Hit the most common list endpoints with pagination.
  const r1 = apiGet('/api/leaves/my?page=1&limit=10');
  check(r1, { 'my leaves 200': (r) => r.status === 200 });

  const r2 = apiGet('/api/notifications?page=1&limit=10');
  check(r2, { 'notifications 200': (r) => r.status === 200 });

  sleep(1);
}
