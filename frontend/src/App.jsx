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
 
import React, { useEffect, useState } from 'react'
import Header from './components/Header'
import WeekView from './components/WeekView.jsx'
import PostForm from './components/PostForm.jsx'
import ChangePassword from './components/ChangePassword'
import LoginPage from './components/LoginPage'
import UserManagement from './components/UserManagement'
import AdminLog from './components/AdminLog'
import { getLists } from './api.js'
import { startOfWeek, addDays } from './utils/date.js'
import { ConfirmProvider } from './components/ConfirmProvider'
import { ToastProvider } from './components/ToastProvider'

export default function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [view, setView] = useState('calendar');
  
  const [lists, setLists] = useState({ creators: [], designers: [], editors: [], statuses: [], platforms: [] });
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [editingPost, setEditingPost] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchTerm.trim()), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    if (user) {
      (async () => {
        try {
          const l = await getLists();
          setLists(l);
        } catch (err) {
          console.error('Failed to fetch lists', err);
        }
      })();
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setView('calendar');
  };

  const handleFinished = () => {
    setEditingPost(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const nextWeek = () => {
    setWeekStart(addDays(weekStart, 7))
    setEditingPost(null)
  }
  
  const prevWeek = () => {
    setWeekStart(addDays(weekStart, -7))
    setEditingPost(null)
  }
  

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
                  {lists.statuses.map(s => {
                    const name = (s && typeof s === 'object') ? (s.name || s.value || '') : s;
                    const color = (s && typeof s === 'object') ? (s.color || 'var(--accent)') : 'var(--accent)';
                    return (
                      <li key={name} style={{ '--status-color': color }}>
                        <span className="badge">{name}</span>
                      </li>
                    )
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
  )
}
