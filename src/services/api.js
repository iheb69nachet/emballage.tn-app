const BASE_URL = 'https://emballage.tn/api/v1';

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

export function clearAuthToken() {
  authToken = null;
}

let onUnauthorized = null;

/** Called when the server rejects the session token (expired / revoked). */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const sentToken = authToken;
  if (sentToken) headers['Authorization'] = `Bearer ${sentToken}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  // Only a request that carried the current session counts. The public /auth/*
  // routes answer 401 for a wrong password or social token too, which must not
  // sign anybody out — /auth/me is the one that checks the session itself.
  const sessionCheck = !path.startsWith('/auth/') || path === '/auth/me';
  if (res.status === 401 && sessionCheck && sentToken && sentToken === authToken) onUnauthorized?.();
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Network error' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Multipart upload — lets fetch set the Content-Type boundary itself. */
async function upload(path, formData) {
  const headers = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Network error' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
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
  googleLogin: (idToken) =>
    request('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),
  appleLogin: (identityToken, fullName) =>
    request('/auth/apple', { method: 'POST', body: JSON.stringify({ identityToken, fullName }) }),
  me: () => request('/auth/me'),
  forgotPassword: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (email, otp, newPassword) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, otp, newPassword }) }),
};

// ── Categories ───────────────────────────────────────────────
export const categories = {
  list: () => request('/categories'),
};

// ── Products ─────────────────────────────────────────────────
export const products = {
  list: async (category, search) => {
    const data = await request('/products');
    let items = Array.isArray(data) ? data : (data?.data ?? []);
    if (category && category !== 'Tous') {
      items = items.filter((p) => p.category === category || p.category?.name === category);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.name?.toLowerCase().includes(q));
    }
    return items;
  },
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
  /**
   * coords: { latitude, longitude } | null — GPS of the delivery point.
   * deliveryMode: 'livraison' (home delivery) | 'retrait' (store pickup, no delivery fee).
   */
  create: (items, address, paymentMethod = 'a_la_livraison', coords = null, deliveryMode = 'livraison') =>
    request('/orders', {
      method: 'POST',
      body: JSON.stringify({
        items, address, paymentMethod, deliveryMode,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      }),
    }),
};

// ── Factures ─────────────────────────────────
export const invoices = {
  /** The signed-in client's own factures (orders that carry an invoice). */
  list: () => request('/orders/invoices'),
};

// ── Printable documents ──────────────────────
/**
 * Short-lived links to the server-rendered facture / devis. They are opened in
 * the system browser, which carries no auth header — hence the one-shot token
 * embedded in the URL.
 */
export const documents = {
  invoiceLink: (orderId) => request(`/documents/orders/${orderId}/invoice/link`),
  quoteLink: (quoteId) => request(`/documents/quotes/${quoteId}/link`),
};

// ── Settings ─────────────────────────────────────────────────
export const settings = {
  payment: () => request('/settings/payment'),
  /**
   * Enabled payment methods, in display order. Signed in, only the ones the
   * admin allowed for this customer (their "modes de règlement").
   */
  paymentMethods: () =>
    request(authToken ? '/settings/payment-methods/me' : '/settings/payment-methods'),
  /** Company identity, droit de timbre and store pickup options. */
  company: () => request('/settings/company'),
};

// ── Users ────────────────────────────────────────────────────
export const users = {
  deleteAccount: () => request('/users/me', { method: 'DELETE' }),
  updateProfile: (data) =>
    request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
};

// ── Quotes ───────────────────────────────────────────────────
export const quotes = {
  list: () => request('/quotes'),
  get: (id) => request(`/quotes/${id}`),
  create: (data) =>
    request('/quotes', { method: 'POST', body: JSON.stringify(data) }),
  /** Accept the offer → creates the order. { paymentMethod, address?, latitude?, longitude? } */
  accept: (id, data) =>
    request(`/quotes/${id}/accept`, { method: 'PATCH', body: JSON.stringify(data) }),
  /** Decline the offer, giving a reason the admin will read. */
  decline: (id, reason) =>
    request(`/quotes/${id}/decline`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
};

// ── Fidelity ─────────────────────────────────────────────────
export const fidelity = {
  getMe: () => request('/fidelity/me'),
};

// ── Notifications ────────────────────────────────────────────
export const notifications = {
  list: () => request('/notifications'),
  unreadCount: () => request('/notifications/unread-count'),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
  savePushToken: (token) =>
    request('/users/me/push-token', { method: 'PATCH', body: JSON.stringify({ token }) }),
};

// ── Admin ─────────────────────────────────────────────────────
export const admin = {
  orders: {
    list: () => request('/orders/admin/all'),
    get: (id) => request(`/orders/${id}`),
    /** cancellationReason is required when status is 'Annulé' — the client reads it in the app. */
    updateStatus: (id, status, cancellationReason) =>
      request(`/orders/admin/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(cancellationReason ? { cancellationReason } : {}) }),
      }),
    /**
     * Approve the payment — which confirms the order, unlocks its facture and
     * deducts the stock. The method is never sent: it stays the one the client
     * chose at checkout and cannot be changed here.
     */
    validatePayment: (id) =>
      request(`/orders/admin/${id}/validate-payment`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      }),
    /** Every order carrying a facture. `search` matches invoice/order/client. */
    invoices: (search) =>
      request(`/orders/admin/invoices${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    /** { invoiceNumber, invoiceNotes?, send?, settlementMode?, settlementBank?, settlementReference? } */
    updateInvoice: (id, data) =>
      request(`/orders/admin/${id}/invoice`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  categories: {
    list: () => request('/categories/admin/all'),
    create: (data) =>
      request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  },
  products: {
    list: () => request('/products/admin/all'),
    create: (data) =>
      request('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) =>
      request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    /** { uri, name, type } → { url } */
    uploadImage: (file) => {
      const fd = new FormData();
      fd.append('image', { uri: file.uri, name: file.name || 'photo.jpg', type: file.type || 'image/jpeg' });
      return upload('/uploads/product-image', fd);
    },
  },
  settings: {
    getPayment: () => request('/settings/payment/admin'),
    updatePayment: (data) =>
      request('/settings/payment', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  company: {
    /** { name?, tagline?, taxId?, rne?, address?, city?, phone?, email?, website?, invoiceFooter?, stampDuty?, pickupEnabled?, pickupAddress?, pickupHours? } */
    update: (data) =>
      request('/settings/company', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  paymentMethods: {
    list: () => request('/settings/payment-methods/admin'),
    create: (data) =>
      request('/settings/payment-methods', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) =>
      request(`/settings/payment-methods/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id) => request(`/settings/payment-methods/${id}`, { method: 'DELETE' }),
    /** { uri, name, type } → { url } */
    uploadImage: (file) => {
      const fd = new FormData();
      fd.append('image', { uri: file.uri, name: file.name || 'photo.jpg', type: file.type || 'image/jpeg' });
      return upload('/uploads/payment-method-image', fd);
    },
  },
  users: {
    list: () => request('/users'),
    paymentModes: () => request('/users/payment-modes'),
    block: (id) => request(`/users/${id}/block`, { method: 'PATCH' }),
    unblock: (id) => request(`/users/${id}/unblock`, { method: 'PATCH' }),
    remove: (id) => request(`/users/${id}`, { method: 'DELETE' }),
    /** paymentModes: string[] (at least one code) */
    setPaymentModes: (id, paymentModes) =>
      request(`/users/${id}/payment-modes`, { method: 'PATCH', body: JSON.stringify({ paymentModes }) }),
    /** Create a client account (active + verified). { email, firstName, lastName, password?, phone?, address?, city?, latitude?, longitude?, paymentModes? } */
    create: (data) =>
      request('/users', { method: 'POST', body: JSON.stringify(data) }),
    /** Update identity / contact / address. { firstName?, lastName?, phone?, address?, city?, latitude?, longitude? } */
    update: (id, data) =>
      request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  quotes: {
    list: () => request('/quotes/admin/all'),
    updateStatus: (id, status) =>
      request(`/quotes/admin/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    /**
     * Send the price offer.
     * payload: { mode: 'global' | 'items', total?, discount?, items?: [{ id?, name, qty, unit?, price, discount? }], message? }
     */
    offerPrice: (id, payload) =>
      request(`/quotes/admin/${id}/offer`, { method: 'PATCH', body: JSON.stringify(payload) }),
  },
  fidelity: {
    list: () => request('/fidelity/admin/users'),
  },
  bundles: {
    list: () => request('/bundles/admin/all'),
    create: (data) =>
      request('/bundles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) =>
      request(`/bundles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id) => request(`/bundles/${id}`, { method: 'DELETE' }),
    /** { uri, name, type } → { url } (same bucket as product photos, like the web dashboard) */
    uploadImage: (file) => {
      const fd = new FormData();
      fd.append('image', { uri: file.uri, name: file.name || 'photo.jpg', type: file.type || 'image/jpeg' });
      return upload('/uploads/product-image', fd);
    },
  },
  ads: {
    list: () => request('/ads/admin/all'),
    create: (data) =>
      request('/ads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) =>
      request(`/ads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id) => request(`/ads/${id}`, { method: 'DELETE' }),
  },
};
