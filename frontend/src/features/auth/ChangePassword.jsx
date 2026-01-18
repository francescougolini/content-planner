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
import { api } from '../../api';
import { InputField } from '../../components/ui/FormField';
import Button from '../../components/ui/Button';

export default function ChangePassword({ user, onPasswordChanged }) {
    const [newPass, setNewPass] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    function isStrongPassword(p) {
        if (!p || p.length < 8) return false;
        let classes = 0;
        if (/[a-z]/.test(p)) classes++;
        if (/[A-Z]/.test(p)) classes++;
        if (/[0-9]/.test(p)) classes++;
        if (/[^A-Za-z0-9]/.test(p)) classes++;
        return classes >= 3;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            await api.post('/change-password', { username: user.username, newPassword: newPass });
            onPasswordChanged();
        } catch (err) {
            console.error(err);
            setError('Failed to update password');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="center-screen">
            <form className="panel panel-width-380" onSubmit={handleSubmit}>
                <div className="brand auth-header-spacer accent-text">Required action</div>

                <div className="notice small mt-15">You must change the password.</div>

                <div className="fld">
                    <span className="muted-small">Username: {user.username}</span>
                </div>

                {error && <div className="notice danger">{error}</div>}

                <InputField
                    label="New secure password:"
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    required
                    placeholder="••••••••"
                    error={
                        !isStrongPassword(newPass) && newPass.length > 0
                            ? 'Password must be at least 8 characters and include at least three of: lowercase, uppercase, numbers, symbols'
                            : null
                    }
                />

                <Button type="submit" variant="primary" full disabled={!isStrongPassword(newPass)} loading={isSubmitting}>
                    Update
                </Button>
            </form>
        </div>
    );
}
