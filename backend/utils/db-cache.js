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

const POSTS_PATH = path.join(__dirname, '..', 'db', 'posts.json');

let postsCache = null;
let cacheTimestamp = 0;

async function getCacheTimestamp() {
  try {
    const stat = await fs.stat(POSTS_PATH);
    return stat.mtimeMs;
  } catch {
    return 0;
  }
}

async function readPostsOptimized() {
  const mtime = await getCacheTimestamp();
  
  if (postsCache !== null && mtime === cacheTimestamp) {
    return postsCache;
  }

  const data = await fs.readFile(POSTS_PATH, 'utf-8');
  const posts = JSON.parse(data || '[]');
  
  postsCache = posts;
  cacheTimestamp = mtime;
  
  return posts;
}

async function writePostsOptimized(posts) {
  const sorted = posts.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (da !== db) return da - db;
    const ta = (a.time || '00:00').split(':').map(Number);
    const tb = (b.time || '00:00').split(':').map(Number);
    return (ta[0] * 60 + ta[1]) - (tb[0] * 60 + tb[1]);
  });

  const tmpPath = POSTS_PATH + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(sorted, null, 2));
  await fs.rename(tmpPath, POSTS_PATH);
  
  postsCache = sorted;
  cacheTimestamp = await getCacheTimestamp();
}

function invalidateCache() {
  postsCache = null;
  cacheTimestamp = 0;
}

module.exports = {
  readPostsOptimized,
  writePostsOptimized,
  invalidateCache,
};
