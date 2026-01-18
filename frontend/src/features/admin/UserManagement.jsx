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

import React, { useState, useEffect, useRef } from 'react';
import { api, getUsers, deleteUser, updateUser } from '../../api';
import Checkbox from '../../components/ui/Checkbox';
import { InputField, SelectField } from '../../components/ui/FormField';
import Button from '../../components/ui/Button';
import AlertModal from '../../components/common/AlertModal';
import { useConfirm } from '../../context/ConfirmProvider';
import { useToast } from '../../context/ToastProvider';

export default function UserManagement() {
    const [role, setRole] = useState('user');
    const [username, setUsername] = useState('');
    const [tempPassword, setTempPassword] = useState('');
    const [users, setUsers] = useState([]);
    const [editing, setEditing] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const confirm = useConfirm();
    const alertRef = useRef(null);
    const toast = useToast();

    // Safety guards: identify current user and admin count
    const loggedInUser = JSON.parse(localStorage.getItem('user')) || {};
    const adminCount = users.filter((u) => u.role === 'admin').length;

    const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/i;
    function validateUsername(u) {
        return USERNAME_RE.test(u || '');
    }

    function isStrongPassword(p) {
        if (!p || p.length < 8) return false;
        let classes = 0;
        if (/[a-z]/.test(p)) classes++;
        if (/[A-Z]/.test(p)) classes++;
        if (/[0-9]/.test(p)) classes++;
        if (/[^A-Za-z0-9]/.test(p)) classes++;
        return classes >= 3;
    }

    const usernameValid = validateUsername(username);
    const passwordValid = isStrongPassword(tempPassword);

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        try {
            const list = await getUsers();
            setUsers(list || []);
        } catch (err) {
            console.error('Failed to load users', err);
        }
    }

    const generateTempPassword = () => {
        const sets = ['abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789', '!@#$%'];
        // Pick one from each class to guarantee coverage
        let password = sets.map((s) => s.charAt(Math.floor(Math.random() * s.length)));
        const allChars = sets.join('');
        // Fill remaining 4 characters randomly to reach length of 8
        for (let i = 0; i < 4; i++) {
            password.push(allChars.charAt(Math.floor(Math.random() * allChars.length)));
        }
        // Shuffle the array
        setTempPassword(password.sort(() => 0.5 - Math.random()).join(''));
    };

    const addUser = async (e) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            await api.post('/users', { username, role, tempPassword });
            toast(`User created — temporary password for ${username}: ${tempPassword}`, 'success');
            setUsername('');
            setTempPassword('');
            await fetchUsers();
        } catch (err) {
            console.error(err);
            alertRef.current?.show(err.message || 'Failed to create user', 'Error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (u) => {
        confirm(
            `Delete user "${u}"?`,
            async () => {
                try {
                    await deleteUser(u);
                    await fetchUsers();
                    toast('User removed', 'success');
                } catch (err) {
                    console.error(err);
                    alertRef.current?.show(err.message || 'Failed to remove user', 'Error');
                }
            },
            'Delete user'
        );
    };

    const openEdit = (u) => {
        setEditing({ username: u.username, role: u.role, mustChangePassword: !!u.mustChangePassword });
    };

    const saveEdit = async () => {
        setIsSaving(true);
        try {
            // Uses the updateUser helper from api.js
            await updateUser(editing.username, {
                role: editing.role,
                mustChangePassword: !!editing.mustChangePassword,
            });
            setEditing(null);
            await fetchUsers();
            toast('User updated', 'success');
        } catch (err) {
            console.error(err);
            alertRef.current?.show(err.message || 'Failed to update user', 'Error');
        } finally {
            setIsSaving(false);
        }
    };

    const getItemString = (item) => {
        if (typeof item === 'string') return item;
        return item?.username || '';
    };

    return (
        <div className="panel admin-panel grid-gap-12">
            <div className="flex-between">
                <div className="brand">User Management</div>
            </div>

            <form onSubmit={addUser} className="mt-6">
                <InputField
                    label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="operator_01"
                    error={!usernameValid && username.length > 0 ? 'Invalid username format' : null}
                />

                <SelectField label="Access level" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </SelectField>

                <InputField
                    label="Temporary Password"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    required
                    error={!passwordValid && tempPassword.length > 0 ? 'Password too weak' : null}
                    right={
                        <Button type="button" size="small" onClick={generateTempPassword}>
                            Generate
                        </Button>
                    }
                />

                <Button
                    type="submit"
                    variant="primary"
                    full
                    disabled={!usernameValid || !passwordValid}
                    loading={isCreating}
                >
                    Create account
                </Button>
            </form>

            <div className="mt-18">
                <h3 className="panel-title">Existing accounts</h3>
                <div className="grid-gap-8">
                    {users
                        .slice()
                        .sort((a, b) => {
                            const nameA = getItemString(a);
                            const nameB = getItemString(b);
                            return nameA.localeCompare(nameB);
                        })
                        .map((u) => {
                            const isSelf = u.username.toLowerCase() === loggedInUser.username?.toLowerCase();
                            const isLastAdmin = u.role === 'admin' && adminCount === 1;

                            return (
                                <div key={u.username} className="remove-item" style={{ alignItems: 'center' }}>
                                    <div>
                                        <strong style={{ color: 'var(--accent)' }}>{u.username}</strong>
                                        <div className="muted-small">
                                            {u.role} {u.mustChangePassword ? '· reset required' : ''}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <Button size="small" onClick={() => openEdit(u)} disabled={isSelf || isLastAdmin}>
                                            Edit
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="danger"
                                            onClick={() => handleDelete(u.username)}
                                            disabled={isSelf || isLastAdmin}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                </div>
                <AlertModal ref={alertRef} />
            </div>

            {editing && (
                <div className="mt-12 border-top">
                    <div className="fld">
                        <span className="pt-12">Edit: {editing.username}</span>
                        <select
                            value={editing.role}
                            disabled={
                                editing.username.toLowerCase() === loggedInUser.username?.toLowerCase() ||
                                (editing.role === 'admin' && adminCount === 1)
                            }
                            title={
                                editing.username.toLowerCase() === loggedInUser.username?.toLowerCase()
                                    ? 'You cannot change your own role'
                                    : ''
                            }
                            onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                        >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div className="inline flex-between">
                        <Checkbox
                            checked={editing.mustChangePassword}
                            onChange={(e) => setEditing({ ...editing, mustChangePassword: e.target.checked })}
                        >
                            Require password change
                        </Checkbox>
                        <div className="flex-gap-8">
                            <Button variant="primary" onClick={saveEdit} loading={isSaving}>
                                Save
                            </Button>
                            <Button variant="secondary" onClick={() => setEditing(null)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
