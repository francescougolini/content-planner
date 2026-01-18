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

import React, { useEffect, useState } from 'react';
import { getPosts, deletePost } from '../../api.js';
import PostCard from '../../features/calendar/PostCard';
import { useConfirm } from '../../context/ConfirmProvider';
import { addDays, formatISODate, dayName, minutesOf } from '../../utils/date.js';

export default function WeekView({ weekStart, lists, onEditPost, refreshTrigger, searchQuery }) {
    const [posts, setPosts] = useState([]);
    const [localRefresh, setLocalRefresh] = useState(0);

    useEffect(() => {
        const start = formatISODate(weekStart);
        const end = formatISODate(addDays(weekStart, 6));
        getPosts(start, end).then(setPosts).catch(console.error);
    }, [weekStart, localRefresh, refreshTrigger]);

    const matchesSearch = (p) => {
        if (!searchQuery) return true;
        const q = String(searchQuery).toLowerCase();
        if ((p.title || '').toLowerCase().includes(q)) return true;
        if ((p.notes || '').toLowerCase().includes(q)) return true;
        if ((p.status || '').toLowerCase().includes(q)) return true;
        const fields = [...(p.creators || []), ...(p.designers || []), ...(p.editors || []), ...(p.platforms || [])];
        if (
            fields.some((x) =>
                String(x || '')
                    .toLowerCase()
                    .includes(q)
            )
        )
            return true;
        return false;
    };

    const confirm = useConfirm();
    async function handleDelete(id) {
        confirm(
            'Are you sure?',
            async () => {
                await deletePost(id);
                setLocalRefresh((x) => x + 1);
            },
            'Delete post'
        );
    }

    const byDay = (idx) => {
        const day = formatISODate(addDays(weekStart, idx));
        return posts
            .filter((p) => p.date === day && matchesSearch(p))
            .sort((a, b) => {
                // All-day posts always appear first
                if (a.isAllDay && !b.isAllDay) return -1;
                if (!a.isAllDay && b.isAllDay) return 1;
                // Then sort by time
                return minutesOf(a.time) - minutesOf(b.time);
            });
    };

    return (
        <div className="week-grid">
            {Array.from({ length: 7 }, (_, i) => (
                <div className="day-column" key={i}>
                    <div className="day-header">
                        <div className="day-name">{dayName(i)}</div>
                        <div className="day-date">{addDays(weekStart, i).toLocaleDateString()}</div>
                    </div>
                    <div className="day-posts">
                        {byDay(i).map((post) => (
                            <PostCard
                                key={post.id}
                                post={post}
                                statusesList={lists.statuses}
                                onDelete={handleDelete}
                                onEdit={onEditPost}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
