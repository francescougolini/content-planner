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
 
const fs = require('fs').promises;
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'db');
const POSTS_PATH = path.join(DB_DIR, 'posts.json');
const LISTS_PATH = path.join(DB_DIR, 'lists.json');
const USERS_PATH = path.join(DB_DIR, 'users.json');
const SESSIONS_PATH = path.join(DB_DIR, 'sessions.json');
const LOGS_PATH = path.join(DB_DIR, 'logs.json');

async function readJSON(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data || 'null');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function writeJSON(filePath, data) {
  // Ensure parent directory exists (defensive)
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // Use a unique temporary name to avoid races when multiple writers run concurrently.
  const tmpPath = `${filePath}.${genId()}.tmp`;
  const payload = JSON.stringify(data, null, 2);

  try {
    await fs.writeFile(tmpPath, payload);

    try {
      // Prefer atomic rename
      await fs.rename(tmpPath, filePath);
      return;
    } catch (err) {
      // If rename fails due to cross-device link, fall back to copy + unlink
      if (err.code === 'EXDEV') {
        await fs.copyFile(tmpPath, filePath);
        await fs.unlink(tmpPath);
        return;
      }
      // If the tmp file disappeared or other issue, try safe fallback
      if (err.code === 'ENOENT') {
        // tmp missing; write directly to destination as a last-resort
        await fs.writeFile(filePath, payload);
        return;
      }
      throw err;
    }
  } catch (err) {
    // Attempt a best-effort fallback: write file directly
    try {
      await fs.writeFile(filePath, payload);
    } catch (err2) {
      // If this also fails, surface the original error for diagnostics
      console.error('writeJSON failed:', err, err2);
      throw err;
    }
  } finally {
    // Clean up any leftover tmp file if present
    try { await fs.unlink(tmpPath); } catch (e) { /* ignore */ }
  }
}

function genId() {
  // Simple unique id: timestamp + random
  return (
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
  );
}

/**
 * Logging helpers using NDJSON append (safer for concurrent writes)
 */
const LOGS_ND_PATH = path.join(DB_DIR, 'logs.ndjson');

async function ensureLogsFile() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    // Create files if missing
    try { await fs.access(LOGS_ND_PATH); } catch (e) { await fs.writeFile(LOGS_ND_PATH, '', { mode: 0o600 }); }
  } catch (err) {
    console.error('Failed to ensure logs file exists', err);
  }
}

async function appendLog(entry) {
  try {
    await ensureLogsFile();
    const now = Date.now();
    const out = Object.assign({ id: genId(), time: now }, entry);
    const line = JSON.stringify(out) + '\n';
    await fs.appendFile(LOGS_ND_PATH, line, 'utf8');
    return out;
  } catch (err) {
    console.error('appendLog failed:', err);
    return null;
  }
}

async function readLogs() {
  try {
    await ensureLogsFile();
    const txt = await fs.readFile(LOGS_ND_PATH, 'utf8');
    if (!txt) return [];
    const lines = txt.split(/\r?\n/).filter(Boolean);
    const out = [];
    for (const l of lines) {
      try { out.push(JSON.parse(l)); } catch (e) { /* skip malformed */ }
    }
    return out;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

module.exports = {
  POSTS_PATH,
  LISTS_PATH,
  USERS_PATH,
  SESSIONS_PATH,
  LOGS_PATH,
  readJSON,
  writeJSON,
  genId,
  appendLog,
  readLogs,
};
