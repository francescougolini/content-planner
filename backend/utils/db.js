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
const lockfile = require('proper-lockfile');
const crypto = require('crypto');

const DB_DIR = path.join(__dirname, '..', 'db');
const POSTS_PATH = path.join(DB_DIR, 'posts.json');
const LISTS_PATH = path.join(DB_DIR, 'lists.json');
const USERS_PATH = path.join(DB_DIR, 'users.json');
const SESSIONS_PATH = path.join(DB_DIR, 'sessions.json');
const LOGS_PATH = path.join(DB_DIR, 'logs.json');

// Configuration for file locking behavior
const LOCK_OPTIONS = {
    retries: {
        retries: 10,
        minTimeout: 50,
        maxTimeout: 500,
        factor: 2,
    },
    stale: 10000,
    realpath: false,
};

// Reduced lock options for fast operations like log appends
const LOCK_OPTIONS_FAST = {
    retries: {
        retries: 5,
        minTimeout: 20,
        maxTimeout: 200,
        factor: 2,
    },
    stale: 5000,
    realpath: false,
};

async function readJSON(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');

        // Verify data integrity using checksums if available
        const checksumPath = `${filePath}.sha256`;
        try {
            const storedChecksum = (await fs.readFile(checksumPath, 'utf-8')).trim();
            const computedChecksum = crypto.createHash('sha256').update(data).digest('hex');

            if (storedChecksum !== computedChecksum) {
                console.error(`CHECKSUM MISMATCH for ${filePath}! Data may be corrupted.`);
                // Attempt to restore from backup if corruption detected
                try {
                    const backupPath = `${filePath}.backup`;
                    const backupData = await fs.readFile(backupPath, 'utf-8');
                    console.log(`Restored ${filePath} from backup`);
                    return JSON.parse(backupData || 'null');
                } catch (backupErr) {
                    console.error('No backup available, using potentially corrupted data');
                }
            }
        } catch (checksumErr) {
            // No checksum file exists (legacy data or first write), continue normally
        }

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

    let release;
    try {
        // Acquire exclusive lock with retry & stale handling
        release = await lockfile.lock(filePath, LOCK_OPTIONS);

        const payload = JSON.stringify(data, null, 2);
        const checksum = crypto.createHash('sha256').update(payload).digest('hex');
        const tmpPath = `${filePath}.${genId()}.tmp`;
        const checksumTmpPath = `${tmpPath}.sha256`;

        // Create backup of existing file before overwriting
        try {
            await fs.copyFile(filePath, `${filePath}.backup`);
        } catch (backupErr) {
            // File might not exist yet, ignore
        }

        // Write to temporary file first
        await fs.writeFile(tmpPath, payload);
        await fs.writeFile(checksumTmpPath, checksum);

        try {
            // Atomic rename - preferred method for data integrity
            await fs.rename(tmpPath, filePath);
            await fs.rename(checksumTmpPath, `${filePath}.sha256`);
        } catch (err) {
            // Handle cross-device link error (tmp and target on different filesystems)
            if (err.code === 'EXDEV') {
                await fs.copyFile(tmpPath, filePath);
                await fs.copyFile(checksumTmpPath, `${filePath}.sha256`);
                await fs.unlink(tmpPath);
                await fs.unlink(checksumTmpPath);
                return;
            }
            // If tmp file disappeared or other issue, try direct write as fallback
            if (err.code === 'ENOENT') {
                await fs.writeFile(filePath, payload);
                await fs.writeFile(`${filePath}.sha256`, checksum);
                return;
            }
            throw err;
        }
    } catch (err) {
        // Best-effort fallback: write file directly (without lock protection)
        // Now that we have `stale` options, this catch block should trigger much less often.
        console.error(`writeJSON lock failed for ${path.basename(filePath)}, attempting direct write:`, err.message);

        try {
            const payload = JSON.stringify(data, null, 2);
            const checksum = crypto.createHash('sha256').update(payload).digest('hex');
            await fs.writeFile(filePath, payload);
            await fs.writeFile(`${filePath}.sha256`, checksum);
        } catch (err2) {
            console.error('Direct writeJSON also failed:', err2);
            throw err;
        }
    } finally {
        // Always release the lock, even if write failed
        if (release) {
            try {
                await release();
            } catch (releaseErr) {
                // If release fails, it's usually because the file was modified or lock was stolen (stale)
                // We log it as a warning but don't crash, as the data is likely safe.
                console.warn('Warning: Failed to release lock (might have been stale):', releaseErr.message);
            }
        }
    }
}
function genId() {
    // Simple unique id generator: timestamp + random component
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * Logging helpers using NDJSON append (safer for concurrent writes)
 */
const LOGS_ND_PATH = path.join(DB_DIR, 'logs.ndjson');

async function ensureLogsFile() {
    try {
        await fs.mkdir(DB_DIR, { recursive: true });
        // Create log file with restricted permissions if it doesn't exist
        try {
            await fs.access(LOGS_ND_PATH);
        } catch (e) {
            await fs.writeFile(LOGS_ND_PATH, '', { mode: 0o600 });
        }
    } catch (err) {
        console.error('Failed to ensure logs file exists', err);
    }
}

async function appendLog(entry) {
    let release;
    try {
        await ensureLogsFile();
        const now = Date.now();
        const out = Object.assign({ id: genId(), time: now }, entry);
        const line = JSON.stringify(out) + '\n';

        // Lock the log file to prevent line interleaving from concurrent appends
        // Use faster lock options since appends are quick operations
        release = await lockfile.lock(LOGS_ND_PATH, LOCK_OPTIONS_FAST);
        await fs.appendFile(LOGS_ND_PATH, line, 'utf8');

        return out;
    } catch (err) {
        console.error('appendLog failed:', err);
        return null;
    } finally {
        if (release) {
            try {
                await release();
            } catch (releaseErr) {
                console.error('Failed to release log lock:', releaseErr);
            }
        }
    }
}

async function readLogs() {
    try {
        await ensureLogsFile();
        const txt = await fs.readFile(LOGS_ND_PATH, 'utf8');
        if (!txt) return [];

        // Parse NDJSON format (one JSON object per line)
        const lines = txt.split(/\r?\n/).filter(Boolean);
        const out = [];
        for (const l of lines) {
            try {
                out.push(JSON.parse(l));
            } catch (e) {
                // Skip malformed log lines instead of failing entirely
                console.error('Skipping malformed log line:', l);
            }
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
    LOCK_OPTIONS,
    LOCK_OPTIONS_FAST,
};
