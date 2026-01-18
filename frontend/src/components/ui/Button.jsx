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

import React, { forwardRef } from 'react';

/**
 * Internal Spinner component for loading states
 */
const Spinner = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
            width: '1.2em',
            height: '1.2em',
            marginRight: '0.5rem',
            display: 'inline-block',
            verticalAlign: 'middle',
            animation: 'btn-spin 1s linear infinite',
        }}
    >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
        <path
            fill="currentColor"
            style={{ opacity: 0.75 }}
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
        <style>{`
      @keyframes btn-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}</style>
    </svg>
);

const Button = forwardRef(
    (
        {
            children,
            variant = '',
            size = 'normal',
            full = false,
            className = '',
            type = 'button',
            loading = false, // Added: state to disable button and show spinner
            disabled = false, // Added: explicitly handle disabled prop
            ...props
        },
        ref
    ) => {
        const classes = ['btn', variant];
        if (size === 'small') classes.push('small');
        if (full) classes.push('full');
        if (loading) classes.push('loading'); // Useful for CSS transitions
        if (className) classes.push(className);

        // The button should be unclickable if it's either manually disabled OR currently loading
        const isDisabled = disabled || loading;

        return (
            <button
                type={type}
                className={classes.join(' ')}
                ref={ref}
                disabled={isDisabled}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.7 : 1,
                    transition: 'all 0.2s ease',
                    ...props.style,
                }}
                {...props}
            >
                {loading && <Spinner />}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export default Button;
