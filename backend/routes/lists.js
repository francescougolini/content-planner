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
const { LISTS_PATH, readJSON, writeJSON, appendLog } = require('../utils/db');

async function ensureLists() {
  const lists = (await readJSON(LISTS_PATH)) || { creators: [], designers: [], editors: [], statuses: [], platforms: [] };
  return lists;
}

router.get('/', async (req, res) => {
  const lists = await ensureLists();
  res.json(lists);
});

function upsert(list, value) {
  // Accept objects (for statuses) and plain strings for simpler lists
  const isObj = typeof value === 'object' && value !== null;
  if (isObj) {
    const nname = String(value.name || '').toLowerCase().trim();
    const exists = list.some(i => {
      const iname = (typeof i === 'object' ? (i.name || '') : String(i)).toLowerCase().trim();
      return iname === nname;
    });
    if (!exists) list.push({ name: String(value.name).trim(), color: value.color });
  } else {
    const nname = String(value || '').toLowerCase().trim();
    const exists = list.some(i => {
      const iname = (typeof i === 'object' ? (i.name || '') : String(i)).toLowerCase().trim();
      return iname === nname;
    });
    if (!exists) list.push(value);
  }
  return list;
}

function remove(list, value) {
  return list.filter(v => {
    const n = typeof v === 'object' ? v.name : v;
    return String(n) !== String(value);
  });
}

const { requireAuth, requireAdmin } = require('../middleware/auth');

router.post('/:type', requireAuth, requireAdmin, async (req, res) => {
  const { type } = req.params; // creators | designers | editors | statuses | platforms
  const { value, color } = req.body;
  if (!value) return res.status(400).json({ error: 'Missing value' });
  const lists = await ensureLists();
  if (!lists[type]) return res.status(400).json({ error: 'Unknown list type' });

  // For statuses, allow providing a colour alongside a string value
  let toInsert = value;
  if (type === 'statuses') {
    if (typeof value === 'string') {
      const name = String(value || '').trim();
      const validatedColor = (color && /^#([0-9a-f]{6})$/i.test(color)) ? color : '#cccccc';
      toInsert = { name, color: validatedColor };
    } else if (typeof value === 'object' && value !== null) {
      // ensure structure
      const name = String(value.name || '').trim();
      const validatedColor = (value.color && /^#([0-9a-f]{6})$/i.test(value.color)) ? value.color : (color && /^#([0-9a-f]{6})$/i.test(color) ? color : '#cccccc');
      toInsert = { name, color: validatedColor };
    }
  }

  lists[type] = upsert(lists[type], toInsert);
  await writeJSON(LISTS_PATH, lists);

  // Log addition
  try {
    await appendLog({ type: 'list', action: 'add', list: type, user: req.user.username, time: Date.now(), item: toInsert });
  } catch (err) {
    console.error('Failed to append list add log', err);
  }

  res.json({ ok: true, [type]: lists[type] });
});

router.delete('/:type/:value', requireAuth, requireAdmin, async (req, res) => {
  const { type, value } = req.params;
  
  const lists = await ensureLists();
  if (!lists[type]) return res.status(400).json({ error: 'Unknown list type' });

  lists[type] = lists[type].filter(v => {
    const n = typeof v === 'object' ? v.name : v;
    return n !== value;
  });
  await writeJSON(LISTS_PATH, lists);

  // Log removal
  try {
    await appendLog({ type: 'list', action: 'remove', list: type, user: req.user.username, time: Date.now(), item: value });
  } catch (err) {
    console.error('Failed to append list remove log', err);
  }

  res.json({ ok: true, [type]: lists[type] });
});

module.exports = router;
