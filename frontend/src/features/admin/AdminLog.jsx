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

import React, { useEffect, useState, useRef } from 'react';
import { getLogs } from '../../api.js';
import Button from '../../components/ui/Button';

export default function AdminLog() {
    const [logs, setLogs] = useState([]);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(100);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    const [q, setQ] = useState('');
    const [user, setUser] = useState('');
    const [action, setAction] = useState('');
    const [type, setType] = useState('');
    const [since, setSince] = useState('');
    const [until, setUntil] = useState('');

    const [actionsOpts, setActionsOpts] = useState([]);
    const [typesOpts, setTypesOpts] = useState([]);
    const kTimeout = useRef(null);

    const fetchLogs = async (opts = {}) => {
        setLoading(true);
        try {
            const res = await getLogs(opts.page || page, opts.per_page || perPage, {
                q: opts.q ?? q,
                user: opts.user ?? user,
                action: opts.action ?? action,
                type: opts.type ?? type,
                since: opts.since ?? since,
                until: opts.until ?? until,
            });
            setLogs(res.items || []);
            setTotal(res.total || 0);
            const acts = new Set();
            const tys = new Set();
            (res.items || []).forEach((i) => {
                if (i.action) acts.add(i.action);
                if (i.type) tys.add(i.type);
            });
            setActionsOpts(Array.from(acts));
            setTypesOpts(Array.from(tys));
        } catch (err) {
            console.error('Failed to load logs', err);
        } finally {
            setLoading(false);
        }
    };

    // Debounced effect for filters and paging
    useEffect(() => {
        if (kTimeout.current) clearTimeout(kTimeout.current);
        kTimeout.current = setTimeout(() => fetchLogs({ page, per_page: perPage }), 250);
        return () => clearTimeout(kTimeout.current);
    }, [page, perPage, q, user, action, type, since, until]);

    const totalPages = Math.max(1, Math.ceil((total || 0) / perPage));

    const clearFilters = () => {
        setQ('');
        setUser('');
        setAction('');
        setType('');
        setSince('');
        setUntil('');
        setPage(1);
    };

    return (
        <div className="panel admin-panel">
            <div className="flex-between">
                <div className="brand">Activity Log</div>
                <div className="muted-small">{total} entries</div>
            </div>

            <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            aria-label="Search logs"
                            className="search-input"
                            placeholder="Search logs…"
                            value={q}
                            onChange={(e) => {
                                setQ(e.target.value);
                                setPage(1);
                            }}
                        />
                        <input
                            aria-label="Filter by user"
                            className="search-input input-sm"
                            placeholder="User"
                            value={user}
                            onChange={(e) => {
                                setUser(e.target.value);
                                setPage(1);
                            }}
                        />
                        <select
                            value={action}
                            onChange={(e) => {
                                setAction(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">All actions</option>
                            {actionsOpts.map((a) => (
                                <option key={a} value={a}>
                                    {a}
                                </option>
                            ))}
                        </select>
                        <select
                            value={type}
                            onChange={(e) => {
                                setType(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">All types</option>
                            {typesOpts.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                        <input
                            aria-label="Since"
                            type="date"
                            value={since}
                            onChange={(e) => {
                                setSince(e.target.value);
                                setPage(1);
                            }}
                        />
                        <input
                            aria-label="Until"
                            type="date"
                            value={until}
                            onChange={(e) => {
                                setUntil(e.target.value);
                                setPage(1);
                            }}
                        />
                        <button type="button" className="btn small" onClick={clearFilters}>
                            Clear
                        </button>
                    </div>
                    <div>
                        <label className="muted-small">Per page:&nbsp;</label>
                        <select
                            value={perPage}
                            onChange={(e) => {
                                setPerPage(parseInt(e.target.value, 10));
                                setPage(1);
                            }}
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={250}>250</option>
                        </select>
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={() => {
                                setPage(1);
                                setPerPage(100);
                                fetchLogs({ page: 1, per_page: 100 });
                            }}
                        >
                            Refresh
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="muted-small">Loading…</div>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {logs.map((r, i) => (
                            <li
                                key={`${r.id || 'log'}-${r.time || ''}-${i}`}
                                className="remove-item"
                                style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <div>
                                        <strong style={{ color: 'var(--accent)' }}>{r.user || 'system'}</strong>
                                        <div className="muted-small">{new Date(r.time).toLocaleString()}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 700 }}>{r.action}</div>
                                        <div className="muted-small">
                                            {r.type}
                                            {r.list ? ` · ${r.list}` : ''}
                                            {r.id ? ` · ${r.id}` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13 }}>
                                    {r.summary
                                        ? JSON.stringify(r.summary)
                                        : r.changes
                                        ? JSON.stringify(r.changes)
                                        : r.item
                                        ? JSON.stringify(r.item)
                                        : ''}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                    <div>
                        <Button size="small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                            Prev
                        </Button>
                        <Button
                            size="small"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            style={{ marginLeft: 8 }}
                            disabled={page >= totalPages}
                        >
                            Next
                        </Button>
                    </div>
                    <div className="muted-small">
                        Page {page} / {totalPages}
                    </div>
                </div>
            </div>
        </div>
    );
}
