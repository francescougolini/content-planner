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

import React, { useState } from 'react';
import { addDays } from '../utils/date.js';
import SearchBox from './SearchBox'

export default function Header({ 
  user, 
  view, 
  setView, 
  weekStart, 
  prevWeek, 
  nextWeek, 
  handleLogout, 
  setUser,
  searchTerm,
  setSearchTerm
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="brand">Content Planner</div>
      </div>

      <div className="header-center">
        {view === 'calendar' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="week-controls">
              <button type="button" className="btn small" onClick={prevWeek}>◀ Prev</button>
              <div className="week-range">
                {weekStart.toLocaleDateString()} – {(addDays(weekStart, 6)).toLocaleDateString()}
              </div>
              <button type="button" className="btn small" onClick={nextWeek}>Next ▶</button>
            </div>
          </div>
        ) : (
          <div className="view-title">User Management</div>
        )}
      </div>

      <div className="header-right">
        {view === 'calendar' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="search-desktop">
              <SearchBox value={searchTerm} onChange={setSearchTerm} onClear={() => setSearchTerm('')} />
            </div>

            <button type="button" className="btn small search-toggle" aria-label="Toggle search" onClick={() => setMobileSearchOpen(s => !s)}>🔍</button>
          </div>
        )}
        {user.role === 'admin' && (
          <>
            <button 
              type="button"
              className="btn small" 
              onClick={() => setView(view === 'calendar' ? 'users' : 'calendar')}
            >
              {view === 'calendar' ? 'Manage Users' : 'Calendar'}
            </button>
            <button type="button" className="btn small" onClick={() => setView('logs')}>View Logs</button>
          </>
        )}
        <button 
          type="button"
          className="btn small" 
          onClick={() => setUser({ ...user, mustChangePassword: true })}
        >
          Reset Password
        </button>
        <button type="button" className="btn small btn-logout" onClick={handleLogout}>Logout</button>

        {typeof window !== 'undefined' && window.innerWidth < 700 && (
          mobileSearchOpen ? (
            <div className="mobile-search">
              <SearchBox value={searchTerm} onChange={setSearchTerm} onClear={() => setSearchTerm('')} />
            </div>
          ) : null
        )}
      </div>
    </header>
  );
}
