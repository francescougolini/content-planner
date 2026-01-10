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

const { readJSON, writeJSON, USERS_PATH, SESSIONS_PATH } = require('../utils/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// In-memory session store: session token -> { username, role, expires }
const sessions = new Map();
const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Export TTL so callers can use it when setting cookie maxAge
exports.SESSION_TTL_MS = DEFAULT_SESSION_TTL_MS;

async function loadSessions() {
  try {
    const arr = (await readJSON(SESSIONS_PATH)) || [];
    const now = Date.now();
    for (const s of arr) {
      if (s.expires && s.expires > now) sessions.set(s.token, { username: s.username, role: s.role, expires: s.expires });
    }
  } catch (err) {
    // Ignore: no persisted sessions found
  }
}

async function persistSessions() {
  try {
    const arr = Array.from(sessions.entries()).map(([token, obj]) => ({ token, ...obj }));
    await writeJSON(SESSIONS_PATH, arr);
  } catch (err) {
    console.error('Failed to persist sessions', err);
  }
}

// Load persisted sessions at startup
loadSessions();

async function getUserByUsername(username) {
  const users = (await readJSON(USERS_PATH)) || [];
  return users.find(u => u.username === (username || '').toLowerCase());
}

/**
 * Middleware: requireAuth
 * - Checks for a valid session token from an HttpOnly cookie (preferred for browsers).
 * - Falls back to header-based session tokens or legacy username+hash authentication for API clients.
 * On success: sets `req.user = { username, role }` and calls next().
 */
async function requireAuth(req, res, next) {
  // First: check cookie-based session (preferred for browsers)
  const cookieToken = req.cookies && req.cookies.session_token;
  if (cookieToken) {
    const session = sessions.get(cookieToken);
    if (session && session.expires > Date.now()) {
      req.user = { username: session.username, role: session.role };
      return next();
    }
    return res.status(401).send('Invalid or expired session');
  }

  // Fallback: header-based session tokens (API clients or legacy behavior)
  const username = (req.headers['x-user-username'] || '').toLowerCase();
  const token = req.headers['x-user-token'];
  const legacyToken = req.headers['x-user-pass']; // legacy: password hash used as token

  if (token) {
    const session = sessions.get(token);
    if (session && session.expires > Date.now()) {
      req.user = { username: session.username, role: session.role };
      return next();
    }
    return res.status(401).send('Invalid or expired session');
  }

  // legacy path: username + legacyToken (hash)
  if (username && legacyToken) {
    const user = await getUserByUsername(username);
    if (!user) return res.status(401).send('User not found');

    // If password was bcrypt hashed, we cannot compare to legacy hash; fall back to direct equality
    if (user.password === legacyToken) {
      req.user = { username: user.username, role: user.role };
      return next();
    }

    // Otherwise, try bcrypt compare (if client sent raw password by mistake)
    try {
      if (await bcrypt.compare(legacyToken, user.password)) {
        req.user = { username: user.username, role: user.role };
        return next();
      }
    } catch (err) {
      // ignore compare errors
    }

    return res.status(401).send('Invalid credentials');
  }

  return res.status(401).send('Missing authentication');
}

/**
 * Middleware: requireAdmin
 * - Ensure the current request is authenticated and the user has the 'admin' role.
 */
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).send('Unauthorised');
  if (req.user.role !== 'admin') return res.status(403).send('Admins only');
  return next();
} 

/**
 * Create a server-side session for `user` and persist it.
 * Returns the session token (hex string). The caller is responsible for
 * setting an HttpOnly cookie named `session_token` where applicable.
 */
async function createSession(user, ttl = DEFAULT_SESSION_TTL_MS) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + ttl;
  sessions.set(token, { username: user.username, role: user.role, expires });
  await persistSessions();
  return token;
}

/**
 * Revoke all sessions for a given username and persist the change.
 */
async function revokeSessionsForUser(username) {
  for (const [t, s] of sessions.entries()) {
    if (s.username === username) sessions.delete(t);
  }
  await persistSessions();
}

// Periodic cleanup of expired sessions
setInterval(async () => {
  const now = Date.now();
  for (const [t, s] of sessions.entries()) if (s.expires <= now) sessions.delete(t);
  await persistSessions();
}, 60 * 60 * 1000); // hourly

module.exports = {
  requireAuth,
  requireAdmin,
  createSession,
  revokeSessionsForUser,
};