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
const { readPostsOptimized, atomicUpdatePost, atomicDeletePost, atomicCreatePost } = require('../utils/db-cache');
const { genId, appendLog } = require('../utils/db');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/posts
 * Fetches posts, optionally filtered by date range.
 */
router.get('/', async (req, res) => {
    try {
        const { start, end } = req.query;
        const posts = await readPostsOptimized();

        let filtered = posts;

        if (start && end) {
            const s = new Date(start);
            const e = new Date(end);
            filtered = posts.filter((p) => {
                const d = new Date(p.date);
                return d >= s && d <= e;
            });
        }

        res.json(filtered);
    } catch (err) {
        console.error('Failed to fetch posts:', err);
        res.status(500).json({ error: 'Failed to read posts' });
    }
});

/**
 * POST /api/posts
 * Creates a new post and notifies all clients via Socket.io.
 */
router.post('/', requireAuth, async (req, res) => {
    try {
        const newPost = {
            ...req.body,
            id: genId(),
            createdBy: req.user.username,
            createdAt: Date.now(),
        };

        const result = await atomicCreatePost(newPost);

        if (result.success) {
            // Log the action
            appendLog({
                type: 'post',
                action: 'create',
                user: req.user.username,
                time: Date.now(),
                item: newPost.id,
                details: { title: newPost.title },
            }).catch((err) => console.error('Log failed', err));

            // BROADCAST: Signal all clients to refresh
            const io = req.app.get('socketio');
            io.emit('data_updated', { type: 'posts', action: 'create', id: newPost.id });

            return res.status(201).json(result.created);
        } else {
            return res.status(500).json({ error: 'Failed to save post' });
        }
    } catch (err) {
        console.error('Error creating post:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PUT /api/posts/:id
 * Updates an existing post and notifies all clients.
 */
router.put('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await atomicUpdatePost(id, (oldPost) => {
            return { ...oldPost, ...req.body, id }; // Ensure ID remains unchanged
        });

        if (result.success) {
            // Log the update
            appendLog({
                type: 'post',
                action: 'update',
                user: req.user.username,
                time: Date.now(),
                item: id,
                changes: req.body,
            }).catch((err) => console.error('Log failed', err));

            // BROADCAST: Signal all clients to refresh
            const io = req.app.get('socketio');
            io.emit('data_updated', { type: 'posts', action: 'update', id });

            return res.json(result.updatedPost);
        } else {
            return res.status(404).json({ error: 'Post not found or update failed' });
        }
    } catch (err) {
        console.error('Error updating post:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/posts/:id
 * Removes a post and notifies all clients.
 */
router.delete('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await atomicDeletePost(id);

        if (result.success) {
            // Log the deletion
            appendLog({
                type: 'post',
                action: 'delete',
                user: req.user.username,
                time: Date.now(),
                item: id,
            }).catch((err) => console.error('Log failed', err));

            // BROADCAST: Signal all clients to refresh
            const io = req.app.get('socketio');
            io.emit('data_updated', { type: 'posts', action: 'delete', id });

            return res.json({ ok: true });
        } else {
            return res.status(404).json({ error: 'Post not found' });
        }
    } catch (err) {
        console.error('Error deleting post:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
