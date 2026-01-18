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

import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const show = useCallback((message, type = 'info', opts = {}) => {
        const id = nextId++;
        const ttl = opts.ttl || (type === 'success' ? 3500 : 5000);
        setToasts((t) => [...t, { id, message, type }]);
        if (ttl > 0) setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
        return id;
    }, []);

    const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

    return (
        <ToastContext.Provider value={show}>
            {children}
            <div className="toast-container" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast ${t.type}`} role="status">
                        <div className="toast-message">{t.message}</div>
                        <button type="button" aria-label="Dismiss" className="toast-close" onClick={() => remove(t.id)}>
                            ✕
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
