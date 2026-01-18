/**
 * Copyright (C) 2025-2026 Francesco Ugolini
 * License: AGPL-3.0-or-later
 *
 * * SECURITY NOTICE:
 * Upon first deployment, a random temporary password is generated
 * and printed to the server terminal. Retrieve it and sign-in to
 * perform the mandatory password reset.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const lockfile = require('proper-lockfile');

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { readJSON, writeJSON, USERS_PATH, LISTS_PATH, POSTS_PATH, appendLog, readLogs, LOCK_OPTIONS } = require('./utils/db');
const { requireAuth, requireAdmin, createSession, revokeSessionsForUser, SESSION_TTL_MS } = require('./middleware/auth');
const { readPostsOptimized } = require('./utils/db-cache');

// SHA-256 Hashing (legacy - only used for migration)
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Initialise Socket.io
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'],
        credentials: true,
    },
});
app.set('socketio', io);

// Basic security headers
app.use(helmet());

// Logging configuration
if (process.env.LOG_FILE) {
    const logStream = fs.createWriteStream(process.env.LOG_FILE, { flags: 'a' });
    app.use(morgan('combined', { stream: logStream }));
} else {
    app.use(morgan('combined'));
}

app.use(cookieParser());

// CORS configuration
const allowed = process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'];
const corsOptions = {
    origin: allowed.length === 1 ? allowed[0] : allowed,
    credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// Rate limits
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.use('/api/login', authLimiter);
app.use('/api/change-password', authLimiter);

const usersLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
const listsLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
const postsLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

app.use('/api/users', usersLimiter);
app.use('/api/lists', listsLimiter);
app.use('/api/posts', postsLimiter);

// Input validation
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
    return classes >= 3;
}

// Ensure DB files exist
const DB_DIR = path.join(__dirname, 'db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(POSTS_PATH)) fs.writeFileSync(POSTS_PATH, JSON.stringify([], null, 2));
if (!fs.existsSync(LISTS_PATH)) {
    const defaults = {
        creators: ['Ernest', 'Francis'],
        designers: ['Pablo', 'Maurits'],
        editors: ['Maxwell'],
        statuses: ['Proposed'],
        platforms: ['Facebook'],
    };
    fs.writeFileSync(LISTS_PATH, JSON.stringify(defaults, null, 2));
}
const LOGS_ND = path.join(__dirname, 'db', 'logs.ndjson');
if (!fs.existsSync(LOGS_ND)) fs.writeFileSync(LOGS_ND, '');

// Initialise Admin (Bootstrap)
(async () => {
    try {
        const users = (await readJSON(USERS_PATH)) || [];

        // Only generate if the user database is completely empty
        if (users.length === 0) {
            // Generate a cryptographically secure, random 12-byte hex string
            const tempPassword = crypto.randomBytes(12).toString('hex');
            const hashed = bcrypt.hashSync(tempPassword, 10);

            await writeJSON(USERS_PATH, [
                {
                    username: 'admin',
                    password: hashed,
                    role: 'admin',
                    mustChangePassword: true,
                },
            ]);

            console.log('\n' + '═'.repeat(60));
            console.log('  SECURITY: INITIAL ADMIN ACCOUNT CREATED');
            console.log('  Username: admin');
            console.log(`  Temporary Password: ${tempPassword}`);
            console.log('  Note: You must change this password immediately upon sign-in.');
            console.log('═'.repeat(60) + '\n');
        }
    } catch (err) {
        console.error('Initialisation Error:', err);
    }
})();

// Socket Connection
io.on('connection', (socket) => {
    console.log(`Live sync: User connected ${socket.id}`);
});

// Routers
const postsRouter = require('./routes/posts');
const listsRouter = require('./routes/lists');
app.use('/api/posts', postsRouter);
app.use('/api/lists', listsRouter);

// CSV Export
function escapeCsv(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
    return str;
}

app.get('/api/export/csv', requireAuth, async (req, res) => {
    try {
        const { dateFrom, dateTo, status } = req.query;
        const posts = await readPostsOptimized();
        let filtered = posts;
        if (dateFrom && dateTo) {
            const from = new Date(dateFrom),
                to = new Date(dateTo);
            filtered = filtered.filter((p) => {
                const d = new Date(p.date);
                return d >= from && d <= to;
            });
        }
        if (status) filtered = filtered.filter((p) => p.status === status);
        const headers = [
            'ID',
            'Title',
            'Date',
            'Time',
            'All Day',
            'Status',
            'Creators',
            'Designers',
            'Editors',
            'Platforms',
            'Notes',
        ];
        const rows = filtered.map((p) => [
            escapeCsv(p.id),
            escapeCsv(p.title),
            escapeCsv(p.date),
            escapeCsv(p.time),
            escapeCsv(p.isAllDay ? 'Yes' : 'No'),
            escapeCsv(p.status),
            escapeCsv((p.creators || []).join('; ')),
            escapeCsv((p.designers || []).join('; ')),
            escapeCsv((p.editors || []).join('; ')),
            escapeCsv((p.platforms || []).join('; ')),
            escapeCsv(p.notes),
        ]);
        const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="posts-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);
    } catch (err) {
        res.status(500).send('Export failed');
    }
});

// Colour Update + Broadcast
app.put('/api/lists/:type/color', requireAuth, requireAdmin, async (req, res) => {
    const { type } = req.params;
    const { name, color } = req.body;
    if (!color || !/^#([0-9a-f]{6})$/i.test(color)) return res.status(400).send('Invalid colour');
    let release;
    try {
        release = await lockfile.lock(LISTS_PATH, LOCK_OPTIONS);
        const lists = (await readJSON(LISTS_PATH)) || {};
        if (lists[type]) {
            const item = lists[type].find(
                (i) => (typeof i === 'object' ? i.name : i).toLowerCase().trim() === String(name).toLowerCase().trim()
            );
            if (item) {
                const prev = item.color;
                item.color = color;
                await writeJSON(LISTS_PATH, lists);
                appendLog({
                    type: 'list',
                    action: 'color-change',
                    list: type,
                    user: req.user.username,
                    time: Date.now(),
                    item: name,
                    changes: { before: prev, after: color },
                }).catch((e) => console.error(e));

                // BROADCAST
                req.app.get('socketio').emit('data_updated', { type: 'lists' });

                return res.json({ success: true, name, color });
            }
        }
        res.status(404).send('Not found');
    } catch (err) {
        res.status(500).send('Save failed');
    } finally {
        if (release) await release();
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).send('Missing credentials');
    let release;
    try {
        release = await lockfile.lock(USERS_PATH, LOCK_OPTIONS);
        const users = (await readJSON(USERS_PATH)) || [];
        const idx = users.findIndex((u) => u.username === username.toLowerCase());
        if (idx === -1) return res.status(401).send('Invalid credentials');
        const user = users[idx];
        if (user.lockUntil && user.lockUntil > Date.now()) return res.status(423).send('Locked');
        let matched = await bcrypt.compare(password, user.password);
        if (!matched && user.password === hash(password)) {
            matched = true;
            users[idx].password = bcrypt.hashSync(password, 10);
            await writeJSON(USERS_PATH, users);
        }
        if (!matched) {
            users[idx].failedLoginAttempts = (users[idx].failedLoginAttempts || 0) + 1;
            if (users[idx].failedLoginAttempts >= 5) users[idx].lockUntil = Date.now() + 15 * 60 * 1000;
            await writeJSON(USERS_PATH, users);
            return res.status(401).send('Invalid');
        }
        users[idx].failedLoginAttempts = 0;
        users[idx].lockUntil = 0;
        await writeJSON(USERS_PATH, users);
        const token = await createSession(user);
        res.cookie('session_token', token, { httpOnly: true, secure: false, sameSite: 'Lax', maxAge: SESSION_TTL_MS });
        res.json({ username: user.username, role: user.role, mustChangePassword: user.mustChangePassword });
    } catch (err) {
        res.status(500).send('Error');
    } finally {
        if (release) await release();
    }
});

// Password Change
app.post('/api/change-password', requireAuth, async (req, res) => {
    const { username, newPassword } = req.body || {};
    if (req.user.username !== username || !isStrongPassword(newPassword)) return res.status(400).send('Invalid');
    let release;
    try {
        release = await lockfile.lock(USERS_PATH, LOCK_OPTIONS);
        const users = (await readJSON(USERS_PATH)) || [];
        const idx = users.findIndex((u) => u.username === username);
        if (idx === -1) return res.status(404).send('Not found');
        users[idx].password = bcrypt.hashSync(newPassword, 10);
        users[idx].mustChangePassword = false;
        await writeJSON(USERS_PATH, users);
        await revokeSessionsForUser(username);
        res.json({ success: true });
    } catch (err) {
        res.status(500).send('Error');
    } finally {
        if (release) await release();
    }
});

// Admin User Management
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = (await readJSON(USERS_PATH)) || [];
        res.json(
            users.map((u) => ({
                username: u.username,
                role: u.role,
                mustChangePassword: !!u.mustChangePassword,
            }))
        );
    } catch (err) {
        res.status(500).send('Error');
    }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    const { username, role, tempPassword } = req.body || {};
    if (!isValidUsername(username) || !isStrongPassword(tempPassword)) {
        return res.status(400).send('Invalid');
    }
    let release;
    try {
        release = await lockfile.lock(USERS_PATH, LOCK_OPTIONS);
        const users = (await readJSON(USERS_PATH)) || [];
        if (users.find((u) => u.username === username.toLowerCase())) {
            return res.status(409).send('Exists');
        }
        users.push({
            username: username.toLowerCase(),
            role: role || 'user',
            password: bcrypt.hashSync(tempPassword, 10),
            mustChangePassword: true,
        });
        await writeJSON(USERS_PATH, users);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).send('Error');
    } finally {
        if (release) await release();
    }
});

// Admin User Management
app.put('/api/users/:username', requireAuth, requireAdmin, async (req, res) => {
    const targetUsername = req.params.username.toLowerCase();
    const requesterUsername = req.user.username.toLowerCase(); // The person making the call
    const { role, mustChangePassword } = req.body;

    if (targetUsername === requesterUsername && role !== undefined) {
        return res.status(400).send('Security Policy: You cannot change your own role. Another administrator must do this.');
    }

    let release;
    try {
        release = await lockfile.lock(USERS_PATH, LOCK_OPTIONS);
        const users = (await readJSON(USERS_PATH)) || [];
        const idx = users.findIndex((u) => u.username === targetUsername);

        if (idx === -1) return res.status(404).send('Not found');

        if (users[idx].role === 'admin' && role === 'user') {
            const adminCount = users.filter((u) => u.role === 'admin').length;
            if (adminCount <= 1) return res.status(400).send('Cannot demote the last administrator.');
        }

        users[idx].role = role || users[idx].role;
        if (mustChangePassword !== undefined) users[idx].mustChangePassword = !!mustChangePassword;

        await writeJSON(USERS_PATH, users);

        if (targetUsername !== requesterUsername && role !== undefined) {
            await revokeSessionsForUser(targetUsername);
        }

        res.json({ ok: true });
    } catch (err) {
        res.status(500).send('Update failed');
    } finally {
        if (release) await release();
    }
});

app.delete('/api/users/:username', requireAuth, requireAdmin, async (req, res) => {
    const targetUsername = req.params.username.toLowerCase();
    const requester = req.user.username.toLowerCase();

    let release;
    try {
        release = await lockfile.lock(USERS_PATH, LOCK_OPTIONS);
        let users = (await readJSON(USERS_PATH)) || [];
        const userToDelete = users.find((u) => u.username === targetUsername);

        if (!userToDelete) return res.status(404).send('Not found');

        // Safety guards
        if (targetUsername === requester) return res.status(400).send('Self-deletion blocked');
        if (userToDelete.role === 'admin' && users.filter((u) => u.role === 'admin').length <= 1) {
            return res.status(400).send('Last administrator blocked');
        }

        const next = users.filter((u) => u.username !== targetUsername);
        await writeJSON(USERS_PATH, next);
        await revokeSessionsForUser(targetUsername);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).send('Error');
    } finally {
        if (release) await release();
    }
});

// Logs
app.get('/api/logs', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { page = 1, per_page = 100 } = req.query;
        let logs = (await readLogs()) || [];
        logs.sort((a, b) => b.time - a.time);
        const p = parseInt(page, 10),
            per = parseInt(per_page, 10);
        res.json({ total: logs.length, page: p, per_page: per, items: logs.slice((p - 1) * per, p * per) });
    } catch (err) {
        res.status(500).send('Error');
    }
});

app.get('/', (req, res) => res.json({ ok: true, service: 'social-calendar-backend' }));

server.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
