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

const express = require('express');
const router = express.Router();
const lockfile = require('proper-lockfile');
const fs = require('fs').promises;
const { LISTS_PATH, LOCK_OPTIONS, appendLog } = require('../utils/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

/**
 * Helper to read lists directly from the filesystem
 */
async function ensureLists() {
    try {
        const data = await fs.readFile(LISTS_PATH, 'utf-8');
        return JSON.parse(data || '{}');
    } catch (err) {
        return { creators: [], designers: [], editors: [], statuses: [], platforms: [] };
    }
}

/**
 * GET /api/lists
 * Returns all available dropdown categories and statuses
 */
router.get('/', async (req, res) => {
    try {
        const lists = await ensureLists();
        res.json(lists);
    } catch (err) {
        console.error('Failed to read lists:', err);
        res.status(500).json({ error: 'Failed to read lists' });
    }
});

/**
 * POST /api/lists/:type
 * Adds a new item to a specific list (e.g., adding a new Creator)
 */
router.post('/:type', requireAuth, requireAdmin, async (req, res) => {
    const { type } = req.params;
    const { value, color } = req.body;

    if (!value) return res.status(400).send('Value is required');

    let release;
    try {
        // Acquire file lock for atomic write
        release = await lockfile.lock(LISTS_PATH, LOCK_OPTIONS);
        const lists = await ensureLists();

        if (!lists[type]) {
            lists[type] = [];
        }

        // Statuses are objects { name, colour }, others are simple strings
        let toAdd = type === 'statuses' ? { name: value, color: color || '#cccccc' } : value;

        lists[type].push(toAdd);

        await fs.writeFile(LISTS_PATH, JSON.stringify(lists, null, 2));

        // Log the addition
        appendLog({
            type: 'list',
            action: 'add-item',
            list: type,
            user: req.user.username,
            time: Date.now(),
            item: value,
        }).catch((err) => console.error('Log failed', err));

        // BROADCAST: Signal all clients that lists have changed
        const io = req.app.get('socketio');
        io.emit('data_updated', { type: 'lists', action: 'add', listType: type });

        res.json({ ok: true });
    } catch (err) {
        console.error('Failed to add to list:', err);
        res.status(500).send('Failed to save list item');
    } finally {
        if (release) {
            try {
                await release();
            } catch (e) {
                console.error('Lock release failed', e);
            }
        }
    }
});

/**
 * DELETE /api/lists/:type/:value
 * Removes an item from a list by name/value
 */
router.delete('/:type/:value', requireAuth, requireAdmin, async (req, res) => {
    const { type, value } = req.params;
    const decodedValue = decodeURIComponent(value);

    let release;
    try {
        release = await lockfile.lock(LISTS_PATH, LOCK_OPTIONS);
        const lists = await ensureLists();

        if (lists[type]) {
            const initialLength = lists[type].length;

            lists[type] = lists[type].filter((item) => {
                const itemName = typeof item === 'object' ? item.name : item;
                return itemName !== decodedValue;
            });

            if (lists[type].length === initialLength) {
                return res.status(404).send('Item not found');
            }

            await fs.writeFile(LISTS_PATH, JSON.stringify(lists, null, 2));

            // Log the deletion
            appendLog({
                type: 'list',
                action: 'remove-item',
                list: type,
                user: req.user.username,
                time: Date.now(),
                item: decodedValue,
            }).catch((err) => console.error('Log failed', err));

            // BROADCAST: Signal all clients that lists have changed
            const io = req.app.get('socketio');
            io.emit('data_updated', { type: 'lists', action: 'delete', listType: type });

            res.json({ ok: true });
        } else {
            res.status(404).send('List type not found');
        }
    } catch (err) {
        console.error('Failed to delete from list:', err);
        res.status(500).send('Failed to update list');
    } finally {
        if (release) {
            try {
                await release();
            } catch (e) {
                console.error('Lock release failed', e);
            }
        }
    }
});

module.exports = router;
