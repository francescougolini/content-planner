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

import { io } from 'socket.io-client';

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

let socket;

/**
 * Initialises the WebSocket connection for live updates.
 * @param {Function} onUpdate - Callback triggered when the server signals a change.
 */
export const initSocket = (onUpdate) => {
    if (!socket) {
        socket = io(SOCKET_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => console.log('Connected to Live Sync'));

        socket.on('data_updated', (data) => {
            // Signals App.jsx to call refreshAllData()
            onUpdate(data);
        });
    }
    return socket;
};

/**
 * Helper to get the username from localStorage for optional server-side convenience headers.
 */
const getAuthHeaders = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const headers = { 'Content-Type': 'application/json' };

    if (user && user.username) {
        headers['x-user-username'] = user.username;
    }

    return headers;
};

/**
 * Centralised HTTP helper that handles Auth and 401s
 */
async function http(path, { method = 'GET', body } = {}) {
    const opts = {
        method,
        headers: getAuthHeaders(),
        credentials: 'include',
    };

    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);

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
    const encoded = encodeURIComponent(String(value || ''));
    return http(`/lists/${type}/${encoded}`, { method: 'DELETE' });
}

export function updateListColor(type, name, color) {
    return http(`/lists/${type}/color`, {
        method: 'PUT',
        body: { name, color },
    });
}

export function getLogs(page = 1, per_page = 100, filters = {}) {
    const params = new URLSearchParams(Object.assign({ page, per_page }, filters));
    return http(`/logs?${params.toString()}`);
}

export function getUsers() {
    return http('/users');
}

export function deleteUser(username) {
    return http(`/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
}

export function updateUser(username, body) {
    return http(`/users/${encodeURIComponent(username)}`, { method: 'PUT', body });
}

export const api = {
    get: (path) => http(path, { method: 'GET' }),
    post: (path, body) => http(path, { method: 'POST', body }),
    put: (path, body) => http(path, { method: 'PUT', body }),
    delete: (path, body) => http(path, { method: 'DELETE', body }),
};
