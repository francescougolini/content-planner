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
const { readPostsOptimized, writePostsOptimized, invalidateCache } = require('../utils/db-cache');
const { genId, appendLog } = require('../utils/db');
const { requireAuth } = require('../middleware/auth');

function inRange(dateStr, startStr, endStr) {
  const d = new Date(dateStr);
  const s = new Date(startStr);
  const e = new Date(endStr);
  return d >= s && d <= e;
}

router.get('/', async (req, res) => {
  const { start, end } = req.query;
  const posts = await readPostsOptimized();

  let filtered = posts;
  if (start && end) {
    filtered = posts.filter(p => inRange(p.date, start, end));
  }
  res.json(filtered);
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const required = ['title', 'date', 'time'];
    for (const k of required) {
      if (!body[k]) return res.status(400).json({ error: `Missing field: ${k}` });
    }
    const posts = await readPostsOptimized();
    const newPost = {
      id: genId(),
      title: body.title,
      date: body.date,
      time: body.time,
      creators: Array.isArray(body.creators) ? body.creators : [],
      editors: Array.isArray(body.editors) ? body.editors : [],
      designers: Array.isArray(body.designers) ? body.designers : [],
      status: body.status || 'Proposed',
      platforms: Array.isArray(body.platforms) ? body.platforms : [],
      notes: body.notes || '',
      createdBy: req.user.username,
    };
    posts.push(newPost);
    await writePostsOptimized(posts);

    try {
      await appendLog({ type: 'post', action: 'create', user: req.user.username, id: newPost.id, summary: { title: newPost.title, date: newPost.date, time: newPost.time, status: newPost.status } });
    } catch (err) {
      console.error('Failed to append post creation log', err);
    }

    res.status(201).json(newPost);
  } catch (err) {
    console.error('Failed to create post', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const posts = await readPostsOptimized();
    const idx = posts.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const old = { ...posts[idx] };
    const updated = { ...posts[idx], ...req.body, id };
    posts[idx] = updated;
    await writePostsOptimized(posts);

    try {
      const changed = {};
      for (const k of ['title','date','time','status','creators','designers','editors','platforms','notes']) {
        const a = JSON.stringify(old[k] || null);
        const b = JSON.stringify(updated[k] || null);
        if (a !== b) changed[k] = { before: JSON.parse(a), after: JSON.parse(b) };
      }
      await appendLog({ type: 'post', action: 'update', user: req.user.username, id, changes: changed });
    } catch (err) {
      console.error('Failed to append post update log', err);
    }

    res.json(updated);
  } catch (err) {
    console.error('Failed to update post', err);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const posts = await readPostsOptimized();
  const idx = posts.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const removed = posts.splice(idx, 1)[0];
  await writePostsOptimized(posts);

  try {
    await appendLog({ type: 'post', action: 'delete', user: req.user.username, id, summary: { title: removed.title, date: removed.date, time: removed.time, status: removed.status } });
  } catch (err) {
    console.error('Failed to append post delete log', err);
  }

  res.json({ ok: true });
});

module.exports = router;
