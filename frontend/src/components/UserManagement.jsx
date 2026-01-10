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
import { api, getUsers, deleteUser, updateUser } from '../api'; 
import Checkbox from './Checkbox'; 
import FormField, { InputField, SelectField } from './FormField';
import Button from './Button'; 
import AlertModal from './AlertModal';
import { useConfirm } from './ConfirmProvider';
import { useToast } from './ToastProvider';

export default function UserManagement() {
  const [role, setRole] = useState('user');
  const [username, setUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);

  const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/i;
  function validateUsername(u) { return USERNAME_RE.test(u || ''); }
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

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try {
      const list = await getUsers();
      setUsers(list || []);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  }

  const generateTempPassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let retVal = "";
    for (let i = 0; i < 8; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setTempPassword(retVal);
  };

  const addUser = async (e) => {
    e.preventDefault();
    
    try {
      const res = await api.post('/users', { 
        username, 
        role, 
        tempPassword 
      });

      // api.js handles 401s; if it reaches here, the call was successful
      toast(`User created — temporary password for ${username}: ${tempPassword}`, 'success');
      setUsername('');
      setTempPassword('');
      await fetchUsers();
    } catch (err) {
      console.error(err);
      alertRef.current?.show('Failed to create user', 'Error');
    }
  };

  const confirm = useConfirm();
  const alertRef = React.useRef(null);
  const toast = useToast();

  const handleDelete = async (u) => {
    confirm(`Delete user "${u}"?`, async () => {
      try {
        await deleteUser(u);
        await fetchUsers();
        toast('User removed', 'success');
      } catch (err) {
        console.error(err);
        alertRef.current?.show('Failed to remove user','Error');
      }
    }, 'Delete user')
  };



  const openEdit = (u) => {
    setEditing({ username: u.username, role: u.role, mustChangePassword: !!u.mustChangePassword });
  };

  const saveEdit = async () => {
    try {
      await updateUser(editing.username, { role: editing.role, mustChangePassword: !!editing.mustChangePassword });
      setEditing(null);
      await fetchUsers();
      toast('User updated','success');
    } catch (err) {
      console.error(err);
      alertRef.current?.show('Failed to update user','Error');
    }
  };

  return (
    <div className="panel admin-panel grid-gap-12">
      <div className="flex-between">
        <div className="brand">Users</div>
      </div>

      <form onSubmit={addUser} className="mt-6">
        <InputField label="Username" value={username} onChange={e => setUsername(e.target.value)} required placeholder="operator_01" error={!usernameValid && username.length > 0 ? "Username must be 3–32 characters and may contain only letters, numbers, '.', '_' or '-'" : null} />

        <SelectField label="Access level" value={role} onChange={e => setRole(e.target.value)}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </SelectField>

        <InputField label="Temporary Password" value={tempPassword} onChange={e => setTempPassword(e.target.value)} required placeholder="Min 8 characters" error={!passwordValid && tempPassword.length > 0 ? 'Password must be at least 8 characters and include at least three of: lowercase, uppercase, numbers, symbols' : null} right={<Button type="button" size="small" onClick={generateTempPassword}>Generate</Button>} />

        <button type="submit" className="btn primary full" disabled={!usernameValid || !passwordValid}>Create account</button>
      </form>

      <div className="mt-18">
        <h3 className="panel-title">Existing accounts</h3>
        <div className="grid-gap-8">
          {users.map(u => (
            <div key={u.username} className="remove-item" style={{ alignItems: 'center' }}>
              <div>
                <strong style={{ color: 'var(--accent)' }}>{u.username}</strong>
                <div className="muted-small">{u.role} {u.mustChangePassword ? '· password reset required' : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="small" onClick={() => openEdit(u)}>Edit</Button>
                <Button size="small" variant="danger" onClick={() => handleDelete(u.username)}>Delete</Button>
              </div>
            </div>          
          ))}
        </div>
        <AlertModal ref={alertRef} />
      </div>

      {editing && (
        <div className="mt-12 border-top">
          <div className="fld">
            <span className="pt-12">Edit: {editing.username}</span>
            <select value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="inline flex-between">
            <Checkbox className="muted-small" checked={editing.mustChangePassword} onChange={e => setEditing({ ...editing, mustChangePassword: e.target.checked })}>
              Require password change
            </Checkbox>
            <div className="flex-gap-8">
              <Button variant="primary" onClick={saveEdit}>Save</Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
