const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type':'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
}

export const api = {
  products: query => request(`/products${query ? `?${query}` : ''}`),
  product: slug => request(`/products/${slug}`),
  quote: payload => request('/checkout/quote',{method:'POST',body:JSON.stringify(payload)}),
  order: (payload, key) => request('/orders',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(payload)}),
  paymentStatus: orderId => request(`/payments/${orderId}/status`),
  newsletter: email => request('/newsletter',{method:'POST',body:JSON.stringify({email})})
};
