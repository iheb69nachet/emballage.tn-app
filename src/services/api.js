const BASE_URL = 'http://196.179.215.31:6650/api/v1';

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

export function clearAuthToken() {
  authToken = null;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Network error' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Auth ──────────────────────────────────────────────────────
export const auth = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  verifyOtp: (email, otp) =>
    request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }),
  resendOtp: (email) =>
    request('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ email }) }),
  me: () => request('/auth/me'),
};

// ── Products ─────────────────────────────────────────────────
export const products = {
  list: (category, search) => {
    const params = new URLSearchParams();
    if (category && category !== 'Tous') params.set('category', category);
    if (search) params.set('search', search);
    const qs = params.toString();
    return request(`/products${qs ? '?' + qs : ''}`);
  },
  categories: () => request('/products/categories'),
  get: (id) => request(`/products/${id}`),
};

// ── Bundles ──────────────────────────────────────────────────
export const bundles = {
  list: () => request('/bundles'),
};

// ── Ads ──────────────────────────────────────────────────────
export const ads = {
  list: () => request('/ads'),
};

// ── Orders ───────────────────────────────────────────────────
export const orders = {
  list: () => request('/orders'),
  get: (id) => request(`/orders/${id}`),
  create: (items, address) =>
    request('/orders', { method: 'POST', body: JSON.stringify({ items, address }) }),
};

// ── Users ────────────────────────────────────────────────────
export const users = {
  updateProfile: (data) =>
    request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
};

// ── Quotes ───────────────────────────────────────────────────
export const quotes = {
  list: () => request('/quotes'),
  create: (data) =>
    request('/quotes', { method: 'POST', body: JSON.stringify(data) }),
};
