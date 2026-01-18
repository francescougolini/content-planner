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

import React from 'react';

export default function SearchBox({ value, onChange, onClear }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
                className="search-input"
                placeholder="Search posts…"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label="Search posts"
            />
            {value ? (
                <button type="button" className="btn small" onClick={() => onClear()} aria-label="Clear search">
                    ✕
                </button>
            ) : null}
        </div>
    );
}
