import { accessToken } from './supabase';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const token = await accessToken();
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}), ...(options.headers || {}) }
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
  myOrders: () => request('/orders/mine'),
  orderDetails: id => request(`/orders/${id}`),
  paymentStatus: orderId => request(`/payments/${orderId}/status`),
  newsletter: email => request('/newsletter',{method:'POST',body:JSON.stringify({email})}),
  trackVisit: payload => request('/analytics/visit',{method:'POST',body:JSON.stringify(payload),keepalive:true}),
  profile: () => request('/account/profile'),
  updateProfile: payload => request('/account/profile',{method:'PATCH',body:JSON.stringify(payload)}),
  addresses: () => request('/account/addresses'),
  addAddress: payload => request('/account/addresses',{method:'POST',body:JSON.stringify(payload)}),
  updateAddress: (id,payload) => request(`/account/addresses/${id}`,{method:'PUT',body:JSON.stringify(payload)}),
  deleteAddress: id => request(`/account/addresses/${id}`,{method:'DELETE'}),
  saveCart: items => request('/account/cart',{method:'PUT',body:JSON.stringify({items})}),
  wishlist: () => request('/account/wishlist'),
  addWishlist: productId => request(`/account/wishlist/${productId}`,{method:'POST'}),
  removeWishlist: productId => request(`/account/wishlist/${productId}`,{method:'DELETE'}),
  submitReview: (productId,payload) => request(`/products/${productId}/reviews`,{method:'POST',body:JSON.stringify(payload)}),
  adminOverview: () => request('/admin/overview'),
  adminProducts: () => request('/admin/products'),
  adminOrders: status => request(`/admin/orders${status?`?status=${encodeURIComponent(status)}`:''}`),
  updateOrderStatus: (id,payload) => request(`/admin/orders/${id}/status`,{method:'PATCH',body:JSON.stringify(payload)}),
  adjustInventory: (variantId,payload) => request(`/admin/inventory/${variantId}/adjust`,{method:'POST',body:JSON.stringify(payload)}),
  createCoupon: payload => request('/admin/coupons',{method:'POST',body:JSON.stringify(payload)})
};
