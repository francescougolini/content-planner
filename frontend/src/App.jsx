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

import React, { useEffect, useState, useCallback } from 'react';
import Header from './components/ui/Header';
import WeekView from './features/calendar/WeekView';
import PostForm from './features/calendar/PostForm';
import ChangePassword from './features/auth/ChangePassword';
import LoginPage from './features/auth/LoginPage';
import UserManagement from './features/admin/UserManagement';
import AdminLog from './features/admin/AdminLog';
import { getLists, initSocket } from './api.js';
import { startOfWeek, addDays } from './utils/date.js';
import { ConfirmProvider } from './context/ConfirmProvider';
import { ToastProvider } from './context/ToastProvider';

export default function App() {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
    const [view, setView] = useState('calendar');

    const [lists, setLists] = useState({ creators: [], designers: [], editors: [], statuses: [], platforms: [] });
    const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
    const [editingPost, setEditingPost] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    /**
     * Centralised refresh logic.
     * Increments refreshTrigger to force WeekView to re-fetch posts
     * and manually re-fetches global lists.
     */
    const refreshAllData = useCallback(async () => {
        try {
            const l = await getLists();
            setLists(l);
            setRefreshTrigger((prev) => prev + 1);
        } catch (err) {
            console.error('Failed to refresh data', err);
        }
    }, []);

    // Debounced search logic
    useEffect(() => {
        const t = setTimeout(() => setSearchQuery(searchTerm.trim()), 250);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // Initial load and Socket.io setup
    useEffect(() => {
        if (user) {
            // Initial fetch
            refreshAllData();

            // LISTEN FOR LIVE UPDATES
            // This connects to the backend and waits for 'data_updated' signals
            initSocket((data) => {
                console.log(`Live sync: ${data.type} updated by another user.`);
                refreshAllData();
            });
        }
    }, [user, refreshAllData]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        setUser(null);
        setView('calendar');
    };

    const handleFinished = () => {
        setEditingPost(null);
        // Local changes also trigger a refresh to ensure sync
        refreshAllData();
    };

    const nextWeek = () => {
        setWeekStart(addDays(weekStart, 7));
        setEditingPost(null);
    };

    const prevWeek = () => {
        setWeekStart(addDays(weekStart, -7));
        setEditingPost(null);
    };

    if (!user) {
        return (
            <LoginPage
                onLogin={(userData) => {
                    localStorage.setItem('user', JSON.stringify(userData));
                    setUser(userData);
                }}
            />
        );
    }

    if (user.mustChangePassword) {
        return <ChangePassword user={user} onPasswordChanged={handleLogout} />;
    }

    return (
        <ToastProvider>
            <ConfirmProvider>
                <div className="app">
                    <Header
                        user={user}
                        view={view}
                        setView={setView}
                        weekStart={weekStart}
                        prevWeek={prevWeek}
                        nextWeek={nextWeek}
                        handleLogout={handleLogout}
                        setUser={setUser}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                    />
                    <main className="grid">
                        {view === 'calendar' ? (
                            <>
                                <aside className="sidebar">
                                    <div className="legend">
                                        <h3 className="panel-title">Status</h3>
                                        <ul>
                                            {lists.statuses.map((s, idx) => {
                                                const name = s && typeof s === 'object' ? s.name || s.value || '' : s;
                                                const color =
                                                    s && typeof s === 'object'
                                                        ? s.color || 'var(--accent)'
                                                        : 'var(--accent)';
                                                return (
                                                    <li key={`${name}-${idx}`} style={{ '--status-color': color }}>
                                                        <span className="badge">{name}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                    <h3 className="panel-title">{editingPost ? 'Update' : 'Add'}</h3>
                                    <PostForm
                                        lists={lists}
                                        onChangeLists={setLists}
                                        weekStart={weekStart}
                                        editingPost={editingPost}
                                        onFinished={handleFinished}
                                    />
                                </aside>
                                <section className="content">
                                    <WeekView
                                        weekStart={weekStart}
                                        lists={lists}
                                        onEditPost={setEditingPost}
                                        refreshTrigger={refreshTrigger}
                                        searchQuery={searchQuery}
                                    />
                                </section>
                            </>
                        ) : view === 'users' ? (
                            <section className="content" style={{ gridColumn: '1 / -1', padding: '20px' }}>
                                <UserManagement />
                            </section>
                        ) : view === 'logs' ? (
                            <section className="content" style={{ gridColumn: '1 / -1', padding: '20px' }}>
                                <AdminLog />
                            </section>
                        ) : null}
                    </main>
                </div>
            </ConfirmProvider>
        </ToastProvider>
    );
}
