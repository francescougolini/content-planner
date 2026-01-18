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
import { InputField } from '../../components/ui/FormField';
import Button from '../../components/ui/Button';

export default function LoginPage({ onLogin }) {
    const [creds, setCreds] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch('http://localhost:4000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(creds),
                credentials: 'include',
            });

            if (res.ok) {
                const userData = await res.json();
                onLogin(userData);
            } else {
                setError('Access denied — invalid credentials');
            }
        } catch (err) {
            setError('Connection error — server offline');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="center-screen">
            <form className="panel panel-width-350" onSubmit={handleSubmit}>
                <div className="brand auth-header-spacer">Login</div>

                {error && <div className="notice danger">{error}</div>}

                <InputField
                    label="Username"
                    value={creds.username}
                    onChange={(e) => setCreds({ ...creds, username: e.target.value })}
                    required
                    placeholder="erik_johansson"
                />
                <InputField
                    label="Secure password"
                    type="password"
                    value={creds.password}
                    onChange={(e) => setCreds({ ...creds, password: e.target.value })}
                    required
                    placeholder="••••••••"
                />
                <Button type="submit" variant="primary" full loading={isLoading}>
                    Log in
                </Button>
            </form>
        </div>
    );
}
