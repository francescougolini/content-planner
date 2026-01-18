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

export function FormField({ label, children, help, error }) {
    return (
        <div className="fld">
            {label && <span>{label}</span>}
            <div className="flex-gap-10-center">
                {children}
                {error ? (
                    <div className="form-help-danger">{error}</div>
                ) : help ? (
                    <div className="form-help">{help}</div>
                ) : null}
            </div>
        </div>
    );
}

export function InputField({ label, value, onChange, type = 'text', placeholder, required, error, help, name, right }) {
    return (
        <FormField label={label} error={error} help={help}>
            <div className="field-right">
                <input
                    name={name}
                    type={type}
                    aria-label={label}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                />
                {right}
            </div>
        </FormField>
    );
}

export function SelectField({ label, value, onChange, children, error, help, name }) {
    return (
        <FormField label={label} error={error} help={help}>
            <select name={name} aria-label={label} value={value} onChange={onChange}>
                {children}
            </select>
        </FormField>
    );
}

export function TextareaField({ label, value, onChange, rows = 3, placeholder, error, help, name }) {
    return (
        <FormField label={label} error={error} help={help}>
            <textarea
                name={name}
                aria-label={label}
                rows={rows}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
            />
        </FormField>
    );
}

export default FormField;
