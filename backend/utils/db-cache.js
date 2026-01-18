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

const POSTS_PATH = path.join(__dirname, '..', 'db', 'posts.json');

let postsCache = null;
let cacheVersion = 0;
let writeInProgress = null;

async function readPostsOptimized() {
    if (postsCache !== null) {
        return postsCache.slice();
    }

    try {
        const data = await fs.readFile(POSTS_PATH, 'utf-8');
        const posts = JSON.parse(data || '[]');
        postsCache = posts;
        cacheVersion++;
        return posts.slice();
    } catch (err) {
        if (err.code === 'ENOENT') {
            postsCache = [];
            return [];
        }
        throw err;
    }
}

async function writePostsOptimized(posts) {
    if (writeInProgress) await writeInProgress;

    writeInProgress = (async () => {
        let release;
        try {
            const sorted = posts.sort((a, b) => {
                const da = new Date(a.date).getTime();
                const db = new Date(b.date).getTime();
                if (da !== db) return da - db;
                const ta = (a.time || '00:00').split(':').map(Number);
                const tb = (b.time || '00:00').split(':').map(Number);
                return ta[0] * 60 + ta[1] - (tb[0] * 60 + tb[1]);
            });

            const { LOCK_OPTIONS } = require('./db');
            release = await lockfile.lock(POSTS_PATH, LOCK_OPTIONS);

            const payload = JSON.stringify(sorted, null, 2);
            const checksum = crypto.createHash('sha256').update(payload).digest('hex');
            const tmpPath = POSTS_PATH + '.tmp.' + Date.now();

            await fs.writeFile(tmpPath, payload);
            await fs.writeFile(tmpPath + '.sha256', checksum);

            await fs.rename(tmpPath, POSTS_PATH);
            await fs.rename(tmpPath + '.sha256', `${POSTS_PATH}.sha256`);

            postsCache = sorted;
            cacheVersion++;
        } catch (err) {
            console.error('Failed to write posts:', err);
            invalidateCache();
            throw err;
        } finally {
            if (release) await release();
            writeInProgress = null;
        }
    })();

    return writeInProgress;
}

function invalidateCache() {
    postsCache = null;
    cacheVersion++;
}

async function atomicUpdatePost(postId, updateFn) {
    let release;
    try {
        const { LOCK_OPTIONS } = require('./db');
        release = await lockfile.lock(POSTS_PATH, LOCK_OPTIONS);

        const data = await fs.readFile(POSTS_PATH, 'utf-8');
        const posts = JSON.parse(data || '[]');

        const idx = posts.findIndex((p) => p.id === postId);
        if (idx === -1) return { success: false, error: 'Post not found' };

        const oldPost = { ...posts[idx] };
        posts[idx] = updateFn(posts[idx]);

        const sorted = posts.sort((a, b) => {
            const da = new Date(a.date).getTime();
            const db = new Date(b.date).getTime();
            if (da !== db) return da - db;
            const ta = (a.time || '00:00').split(':').map(Number);
            const tb = (b.time || '00:00').split(':').map(Number);
            return ta[0] * 60 + ta[1] - (tb[0] * 60 + tb[1]);
        });

        const payload = JSON.stringify(sorted, null, 2);
        const checksum = crypto.createHash('sha256').update(payload).digest('hex');
        const tmpPath = POSTS_PATH + '.tmp.' + Date.now();

        await fs.writeFile(tmpPath, payload);
        await fs.writeFile(tmpPath + '.sha256', checksum);
        await fs.rename(tmpPath, POSTS_PATH);
        await fs.rename(tmpPath + '.sha256', `${POSTS_PATH}.sha256`);

        postsCache = sorted;
        cacheVersion++;
        return { success: true, oldPost, updatedPost: posts[idx], allPosts: sorted };
    } catch (err) {
        invalidateCache();
        return { success: false, error: err.message };
    } finally {
        if (release) await release();
    }
}

async function atomicDeletePost(postId) {
    let release;
    try {
        const { LOCK_OPTIONS } = require('./db');
        release = await lockfile.lock(POSTS_PATH, LOCK_OPTIONS);

        const data = await fs.readFile(POSTS_PATH, 'utf-8');
        const posts = JSON.parse(data || '[]');

        const idx = posts.findIndex((p) => p.id === postId);
        if (idx === -1) return { success: false, error: 'Post not found' };

        const deleted = posts.splice(idx, 1)[0];
        const payload = JSON.stringify(posts, null, 2);
        const checksum = crypto.createHash('sha256').update(payload).digest('hex');
        const tmpPath = POSTS_PATH + '.tmp.' + Date.now();

        await fs.writeFile(tmpPath, payload);
        await fs.writeFile(tmpPath + '.sha256', checksum);
        await fs.rename(tmpPath, POSTS_PATH);
        await fs.rename(tmpPath + '.sha256', `${POSTS_PATH}.sha256`);

        postsCache = posts;
        cacheVersion++;
        return { success: true, deleted, allPosts: posts };
    } catch (err) {
        invalidateCache();
        return { success: false, error: err.message };
    } finally {
        if (release) await release();
    }
}

async function atomicCreatePost(newPost) {
    let release;
    try {
        const { LOCK_OPTIONS } = require('./db');
        release = await lockfile.lock(POSTS_PATH, LOCK_OPTIONS);

        const data = await fs.readFile(POSTS_PATH, 'utf-8');
        const posts = JSON.parse(data || '[]');
        posts.push(newPost);

        const sorted = posts.sort((a, b) => {
            const da = new Date(a.date).getTime();
            const db = new Date(b.date).getTime();
            if (da !== db) return da - db;
            const ta = (a.time || '00:00').split(':').map(Number);
            const tb = (b.time || '00:00').split(':').map(Number);
            return ta[0] * 60 + ta[1] - (tb[0] * 60 + tb[1]);
        });

        const payload = JSON.stringify(sorted, null, 2);
        const checksum = crypto.createHash('sha256').update(payload).digest('hex');
        const tmpPath = POSTS_PATH + '.tmp.' + Date.now();

        await fs.writeFile(tmpPath, payload);
        await fs.writeFile(tmpPath + '.sha256', checksum);
        await fs.rename(tmpPath, POSTS_PATH);
        await fs.rename(tmpPath + '.sha256', `${POSTS_PATH}.sha256`);

        postsCache = sorted;
        cacheVersion++;
        return { success: true, created: newPost, allPosts: sorted };
    } catch (err) {
        invalidateCache();
        return { success: false, error: err.message };
    } finally {
        if (release) await release();
    }
}

module.exports = {
    readPostsOptimized,
    writePostsOptimized,
    invalidateCache,
    atomicUpdatePost,
    atomicDeletePost,
    atomicCreatePost,
};
