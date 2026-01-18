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

import React, { forwardRef, useRef, useImperativeHandle, useEffect } from 'react';

// Accessible wrapper around the native <dialog> element.
// Provides stable labelled regions for screen readers.
const Modal = forwardRef(function Modal({ children, title, className = '', ...props }, ref) {
    const dlgRef = useRef(null);
    const idRef = useRef(`modal-${Math.random().toString(36).slice(2, 9)}`);
    const titleId = `${idRef.current}-title`;
    const bodyId = `${idRef.current}-body`;
    const prevActiveRef = useRef(null);

    // Helper: find focusable elements inside the dialog
    const getFocusable = (root) => {
        if (!root) return [];
        const nodes = root.querySelectorAll(
            'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        return Array.from(nodes).filter((n) => n.offsetWidth || n.offsetHeight || n.getClientRects().length);
    };

    useImperativeHandle(ref, () => ({
        showModal: () => {
            if (!dlgRef.current) return;
            prevActiveRef.current = document.activeElement;
            dlgRef.current.showModal?.();
            // After opening, move focus to the first focusable element or the dialog itself
            setTimeout(() => {
                const focusables = getFocusable(dlgRef.current);
                if (focusables.length) focusables[0].focus();
                else dlgRef.current.focus();
            }, 0);
        },
        close: () => {
            if (!dlgRef.current) return;
            try {
                dlgRef.current.close?.();
            } catch (_e) {
                /* ignore */
            }
            // restore previous focus if possible
            try {
                prevActiveRef.current?.focus?.();
            } catch (_e) {
                /* ignore */
            }
        },
        element: () => dlgRef.current,
    }));

    // Keyboard handling: trap Tab and close on Escape
    useEffect(() => {
        const el = dlgRef.current;
        if (!el) return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                try {
                    el.close?.();
                } catch (_err) {
                    /* ignore */
                }
                try {
                    prevActiveRef.current?.focus?.();
                } catch (_err) {
                    /* ignore */
                }
                return;
            }
            if (e.key === 'Tab') {
                const focusables = getFocusable(el);
                if (focusables.length === 0) {
                    e.preventDefault();
                    return;
                }
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                } else if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            }
        };
        el.addEventListener('keydown', onKey);
        return () => el.removeEventListener('keydown', onKey);
    }, []);

    return (
        <dialog
            ref={dlgRef}
            className={`panel modal ${className}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={bodyId}
            {...props}
        >
            {title && (
                <div id={titleId} className="panel-title">
                    {title}
                </div>
            )}
            <div id={bodyId} className="modal-body">
                {children}
            </div>
        </dialog>
    );
});

export default Modal;
