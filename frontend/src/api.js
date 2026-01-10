/**
 * Copyright (C) 2025-2026 Francesco Ugolini
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
 
const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'

/**
 * Helper to get the username from localStorage for optional server-side convenience headers.
 */
const getAuthHeaders = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  const headers = { 'Content-Type': 'application/json' };
  
  // Do not send session tokens in headers for browsers: we rely on HttpOnly cookies.
  // Send username header if available for server-side convenience (optional).
  if (user && user.username) {
    headers['x-user-username'] = user.username;
  }
  
  return headers;
};

/**
 * Centralized HTTP helper that handles Auth and 401s
 */
async function http(path, { method = 'GET', body } = {}) {
  const opts = { 
    method, 
    headers: getAuthHeaders(),
    // Important: include credentials so browser sends HttpOnly session cookie
    credentials: 'include'
  };

  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);

  // If unauthorised, clear local storage and reload to show the login view
  if (res.status === 401) {
    localStorage.removeItem('user');
    window.location.reload();
    return;
  }

  if (!res.ok) throw new Error(await res.text());
  
  return res.status === 204 ? null : res.json();
}

// --- Standard Exports ---

export function getPosts(start, end) {
  const qs = start && end ? `?start=${start}&end=${end}` : '';
  return http(`/posts${qs}`);
}

export function createPost(p) {
  return http('/posts', { method: 'POST', body: p });
}

export function updatePost(id, p) {
  return http(`/posts/${id}`, { method: 'PUT', body: p });
}

export function deletePost(id) {
  return http(`/posts/${id}`, { method: 'DELETE' });
}

export function getLists() {
  return http('/lists');
}

export function addToList(type, p) {
  return http(`/lists/${type}`, { method: 'POST', body: p });
}

export function removeFromList(type, value) {
  // Router expects the value in the URL path to avoid ambiguous DELETE bodies
  const encoded = encodeURIComponent(String(value || ''));
  return http(`/lists/${type}/${encoded}`, { method: 'DELETE' });
}

export function updateListColor(type, name, color) {
  return http(`/lists/${type}/color`, { 
    method: 'PUT', 
    body: { name, color } 
  });
}

export function getLogs(page = 1, per_page = 100, filters = {}) {
  const params = new URLSearchParams(Object.assign({ page, per_page }, filters));
  return http(`/logs?${params.toString()}`);
}

// Users management helpers
export function getUsers() {
  return http('/users');
}

export function deleteUser(username) {
  return http(`/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
}

export function updateUser(username, body) {
  return http(`/users/${encodeURIComponent(username)}`, { method: 'PUT', body });
}

/**
 * NEW: The 'api' object export
 * This allows your components to call api.post(), api.get(), etc.
 */
export const api = {
  get: (path) => http(path, { method: 'GET' }),
  post: (path, body) => http(path, { method: 'POST', body }),
  put: (path, body) => http(path, { method: 'PUT', body }),
  delete: (path, body) => http(path, { method: 'DELETE', body }),
};
