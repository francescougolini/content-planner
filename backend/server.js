/**
 * Copyright (C) 2025-2026 Francesco Ugolini
 * License: AGPL-3.0-or-later
 * 
 * * SECURITY NOTICE:
 * Upon first deployment, log in with the default admin credentials
 * and change the password immediately.
 */
 
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { readJSON, writeJSON, USERS_PATH, LISTS_PATH, POSTS_PATH, appendLog, readLogs } = require('./utils/db');
const { requireAuth, requireAdmin, createSession, revokeSessionsForUser, SESSION_TTL_MS } = require('./middleware/auth');
const { readPostsOptimized } = require('./utils/db-cache');

// SHA-256 Hashing (legacy)
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');

const app = express();
const PORT = process.env.PORT || 4000;

// Basic security headers
app.use(helmet());

// Logging
if (process.env.LOG_FILE) {
  const logStream = fs.createWriteStream(process.env.LOG_FILE, { flags: 'a' });
  app.use(morgan('combined', { stream: logStream }));
} else {
  app.use(morgan('combined'));
}

// Cookie parser (required for cookie-based sessions)
app.use(cookieParser());

// CORS: configured via CORS_ALLOWED_ORIGINS (comma-separated). If not set, allow localhost:5173 for dev.
const corsOptions = {};
const allowed = process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'];
if (allowed.length === 1) {
  corsOptions.origin = allowed[0];
} else {
  corsOptions.origin = allowed;
}
// Allow credentials to enable HttpOnly cookies across origins
corsOptions.credentials = true;
app.use(cors(corsOptions));
app.use(express.json());

// Rate limit for authentication endpoints
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.use('/api/login', authLimiter);
app.use('/api/change-password', authLimiter);

// Additional rate limits
const usersLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 }); // 30 requests / min per IP
const listsLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
const postsLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// Apply to mutating endpoints
app.use('/api/users', usersLimiter);
app.use('/api/lists', listsLimiter);
app.use('/api/posts', postsLimiter);

// Simple input validation helpers
const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/i;
function isValidUsername(s) {
  return USERNAME_RE.test(s || '');
}

function isStrongPassword(p) {
  if (!p || p.length < 8) return false;
  let classes = 0;
  if (/[a-z]/.test(p)) classes++;
  if (/[A-Z]/.test(p)) classes++;
  if (/[0-9]/.test(p)) classes++;
  if (/[^A-Za-z0-9]/.test(p)) classes++;
  return classes >= 3; // at least three character classes
}

// Ensure DB files exist with sane defaults
const DB_DIR = path.join(__dirname, 'db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// Ensure posts and lists exist (use sync for startup simplicity)
if (!fs.existsSync(POSTS_PATH)) fs.writeFileSync(POSTS_PATH, JSON.stringify([], null, 2));
if (!fs.existsSync(LISTS_PATH)) {
  const defaults = {
    creators: ["Ernest", "Francis"],
    designers: ["Pablo", "Maurits"],
    editors: ["Maxwell"],
    statuses: ["Proposed", "Validated", "Frozen", "Postponed", "Reminder", "TBC"],
    platforms: [
      "Facebook", "Twitter", "Instagram", "Mastodon", "X", "BlueSky", "IGBC", "WhatsApp", "LinkedIn"
    ]
  };
  fs.writeFileSync(LISTS_PATH, JSON.stringify(defaults, null, 2));
}
// Ensure log ndjson file exists
const LOGS_ND = path.join(__dirname, 'db', 'logs.ndjson');
if (!fs.existsSync(LOGS_ND)) fs.writeFileSync(LOGS_ND, '');

// Ensure users file exists and has a default admin (stored with bcrypt)
(async () => {
  try {
    const users = (await readJSON(USERS_PATH)) || [];
    if (users.length === 0) {
      const hashed = bcrypt.hashSync('Welcome123!', 10);
      const defaultAdmin = [ { username: 'admin', password: hashed, role: 'admin', mustChangePassword: true } ];
      await writeJSON(USERS_PATH, defaultAdmin);
      console.log('Created default admin account — please change the password');
    }
  } catch (err) {
    console.error('Failed to ensure users file exists', err);
  }
})();

// Routers
const postsRouter = require('./routes/posts');
const listsRouter = require('./routes/lists');

// Attach routers
app.use('/api/posts', postsRouter);
app.use('/api/lists', listsRouter);

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

app.get('/api/export/csv', requireAuth, async (req, res) => {
  try {
    const { dateFrom, dateTo, status } = req.query;
    const posts = await readPostsOptimized();

    let filtered = posts;

    if (dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      filtered = filtered.filter(p => {
        const d = new Date(p.date);
        return d >= from && d <= to;
      });
    }

    if (status) {
      filtered = filtered.filter(p => p.status === status);
    }

    const headers = ['ID', 'Title', 'Date', 'Time', 'Status', 'Creators', 'Designers', 'Editors', 'Platforms', 'Notes'];
    const rows = filtered.map(p => [
      escapeCsv(p.id),
      escapeCsv(p.title),
      escapeCsv(p.date),
      escapeCsv(p.time),
      escapeCsv(p.status),
      escapeCsv((p.creators || []).join('; ')),
      escapeCsv((p.designers || []).join('; ')),
      escapeCsv((p.editors || []).join('; ')),
      escapeCsv((p.platforms || []).join('; ')),
      escapeCsv(p.notes),
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="posts-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Failed to export CSV', err);
    res.status(500).send('Failed to export');
  }
});

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'social-calendar-backend' });
});

const server = app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

app.put('/api/lists/:type/color', requireAuth, requireAdmin, async (req, res) => {
  const { type } = req.params; // 'statuses'
  const { name, color } = req.body; // Data sent from frontend

  // Validate colour input
  if (!color || !/^#([0-9a-f]{6})$/i.test(color)) return res.status(400).send('Invalid colour');

  try {
    const lists = (await readJSON(LISTS_PATH)) || {};

    if (lists[type]) {
      const item = lists[type].find(i => {
        const iname = (typeof i === 'object' ? (i.name || '') : String(i)).toLowerCase().trim();
        return iname === String(name || '').toLowerCase().trim();
      });
      if (item) {
        const prev = item.color;
        item.color = color;
        await writeJSON(LISTS_PATH, lists);
        try {
          await appendLog({ type: 'list', action: 'color-change', list: type, user: req.user.username, time: Date.now(), item: name, changes: { before: prev, after: color } });
        } catch (err) { console.error('Failed to append color-change log', err); }
        return res.json({ success: true, name, color });
      }
    }

    res.status(404).send('Item not found');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to save colour');
  }
});

// Note: list add/remove endpoints are implemented in ./routes/lists.js

// Authentication - Login route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).send('Missing credentials');

  const users = (await readJSON(USERS_PATH)) || [];
  const idx = users.findIndex(u => u.username === username.toLowerCase());
  if (idx === -1) return res.status(401).send('Invalid credentials');

  const user = users[idx];

  // Check lockout
  if (user.lockUntil && user.lockUntil > Date.now()) return res.status(423).send('Account locked — try again later');

  // 1. Try bcrypt compare (preferred)
  let matched = false;
  try {
    matched = await bcrypt.compare(password, user.password);
  } catch (err) {
    matched = false;
  }

  // 2. Legacy SHA-256 check
  if (!matched && user.password === hash(password)) {
    matched = true;
    // Migrate to bcrypt
    const newHash = bcrypt.hashSync(password, 10);
    users[idx].password = newHash;
    await writeJSON(USERS_PATH, users);
    console.log(`Migrated password for ${username} to bcrypt`);
  }

  if (!matched) {
    // increment failed attempts
    users[idx].failedLoginAttempts = (users[idx].failedLoginAttempts || 0) + 1;
    if (users[idx].failedLoginAttempts >= 5) {
      users[idx].lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
      users[idx].failedLoginAttempts = 0;
    }
    await writeJSON(USERS_PATH, users);
    return res.status(401).send('Invalid credentials');
  }

  // successful login: reset counters
  users[idx].failedLoginAttempts = 0;
  users[idx].lockUntil = 0;
  await writeJSON(USERS_PATH, users);

  const sessionToken = await createSession(user);
  // Set cookie for browsers
  res.cookie('session_token', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax',
    maxAge: SESSION_TTL_MS
  });

  // Return user information only. For browser clients, authentication is via the HttpOnly cookie; the response does not include a token.
  res.json({ username: user.username, role: user.role, mustChangePassword: user.mustChangePassword });
});

// Authentication - Change password route
app.post('/api/change-password', requireAuth, async (req, res) => {
  const { username, newPassword } = req.body || {};
  if (!username || !newPassword) return res.status(400).send('Missing fields');

  if (req.user.username !== username) return res.status(403).send("Cannot change another user's password");

  if (!isStrongPassword(newPassword)) return res.status(400).send('Password does not meet complexity requirements');

  const users = (await readJSON(USERS_PATH)) || [];
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) return res.status(404).send('User not found');

  users[idx].password = bcrypt.hashSync(newPassword, 10);
  users[idx].mustChangePassword = false;
  await writeJSON(USERS_PATH, users);

  // Revoke existing sessions for this user
  await revokeSessionsForUser(username);

  res.json({ success: true });
});

// Authentication - Admin - Add users
app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, role, tempPassword } = req.body || {};
  if (!username || !tempPassword) return res.status(400).send('Missing fields');

  if (!isValidUsername(username)) return res.status(400).send('Invalid username format');
  if (!isStrongPassword(tempPassword)) return res.status(400).send('Password does not meet complexity requirements');

  const users = (await readJSON(USERS_PATH)) || [];
  const exists = users.find(u => u.username === username.toLowerCase());
  if (exists) return res.status(409).send('User already exists');

  users.push({
    username: username.toLowerCase(),
    role: role || 'user',
    password: bcrypt.hashSync(tempPassword, 10), // Store bcrypt hashed
    mustChangePassword: true
  });
  await writeJSON(USERS_PATH, users);

  try {
    await appendLog({ type: 'user', action: 'create', user: req.user.username, time: Date.now(), item: { username: username.toLowerCase(), role: role || 'user' } });
  } catch (err) { console.error('Failed to append user-create log', err); }

  res.json({ ok: true });
});

// List users (sanitised) - admin only
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = (await readJSON(USERS_PATH)) || [];
    const list = users.map(u => ({ username: u.username, role: u.role, mustChangePassword: !!u.mustChangePassword }));
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to read users');
  }
});

// ADMIN: GET activity logs (with optional paging and filters)
app.get('/api/logs', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, per_page = 100, user, action, type, q, since, until } = req.query;
    let logs = (await readLogs()) || [];

    // Filtering
    if (user) {
      const u = String(user).toLowerCase();
      logs = logs.filter(l => (l.user || '').toLowerCase().includes(u));
    }
    if (action) {
      const a = String(action).toLowerCase();
      logs = logs.filter(l => (l.action || '').toLowerCase() === a);
    }
    if (type) {
      const t = String(type).toLowerCase();
      logs = logs.filter(l => (l.type || '').toLowerCase() === t);
    }
    if (q) {
      const qq = String(q).toLowerCase();
      logs = logs.filter(l => JSON.stringify(l).toLowerCase().includes(qq));
    }
    if (since) {
      const s = Date.parse(since);
      if (!Number.isNaN(s)) logs = logs.filter(l => l.time >= s);
    }
    if (until) {
      const u = Date.parse(until);
      if (!Number.isNaN(u)) logs = logs.filter(l => l.time <= u);
    }

    // Sort newest-first
    logs.sort((a, b) => b.time - a.time);

    const total = logs.length;
    const p = parseInt(page, 10) || 1;
    const per = Math.min(parseInt(per_page, 10) || 100, 1000);
    const start = (p - 1) * per;
    const slice = logs.slice(start, start + per);
    res.json({ total, page: p, per_page: per, items: slice });
  } catch (err) {
    console.error('Failed to read logs', err);
    res.status(500).send('Failed to read logs');
  }
});

// Delete user (admin only)
app.delete('/api/users/:username', requireAuth, requireAdmin, async (req, res) => {
  const username = (req.params.username || '').toLowerCase();
  try {
    let users = (await readJSON(USERS_PATH)) || [];
    const next = users.filter(u => u.username !== username);
    if (next.length === users.length) return res.status(404).send('Not found');
    await writeJSON(USERS_PATH, next);
    // Revoke sessions as well
    await revokeSessionsForUser(username);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to delete user');
  }
});

// Admin: revoke sessions for a user
app.post('/api/users/:username/revoke-sessions', requireAuth, requireAdmin, async (req, res) => {
  const username = (req.params.username || '').toLowerCase();
  await revokeSessionsForUser(username);
  res.json({ ok: true });
});

// Update user (role / mustChangePassword / set temp password) - admin only
app.put('/api/users/:username', requireAuth, requireAdmin, async (req, res) => {
  const username = (req.params.username || '').toLowerCase();
  const { role, mustChangePassword, tempPassword } = req.body || {};
  try {
    const users = (await readJSON(USERS_PATH)) || [];
    const idx = users.findIndex(u => u.username === username);
    if (idx === -1) return res.status(404).send('Not found');

    if (role) users[idx].role = role;
    if (typeof mustChangePassword !== 'undefined') users[idx].mustChangePassword = !!mustChangePassword;
    if (tempPassword) users[idx].password = bcrypt.hashSync(tempPassword, 10);

    await writeJSON(USERS_PATH, users);
    const out = { username: users[idx].username, role: users[idx].role, mustChangePassword: users[idx].mustChangePassword };
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to update user');
  }
});

