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
 
import React from 'react'
import Button from './Button'

const getStatusColor = (statusName, statusesList = []) => {
  const statusObj = statusesList.find(s => {
    if (typeof s === 'string') return s === statusName;
    return s && (s.name === statusName || s.value === statusName);
  });
  if (!statusObj) return '#FFFFFF';
  return (typeof statusObj === 'string') ? '#FFFFFF' : (statusObj.color || '#FFFFFF');
};

export default function PostCard({ post, onDelete, onEdit, statusesList }) {
  const statusColor = getStatusColor(post.status, statusesList);
  const platforms = Array.isArray(post.platforms) ? post.platforms : [];
  const creators = Array.isArray(post.creators) ? post.creators : [];
	const designers = Array.isArray(post.designers) ? post.designers : [];
  const editors = Array.isArray(post.editors) ? post.editors : [];

  return (
    <div className="post-card" style={{ '--status-color': statusColor }}>
      <div className="post-time">{post.time}</div>
      <div className="post-title">{post.title}</div>
      
      <div className="post-meta">
        {creators.length > 0 && (
		      <div className="meta-line">
		        <span className="label">Creators</span>
		        <span className="val">{creators.join(', ') || '—'}</span>
		      </div>
        )}
        {designers.length > 0 && (
		      <div className="meta-line">
		        <span className="label">Designers</span>
		        <span className="val">{designers.join(', ') || '—'}</span>
		      </div>
        )}
        {editors.length > 0 && (
        <div className="meta-line">
          <span className="label">Editors</span>
          <span className="val">{editors.join(', ') || '—'}</span>
        </div>
        )}
      </div>

      <div className="post-platforms">
        {platforms.map(p => (
          <span className="badge platform" key={p}>{p}</span>
        ))}
      </div>
      
      {post.notes && <div className="post-notes-row">{post.notes}</div>}

      <div className="post-actions">
        <Button size="small" onClick={() => onEdit(post)}>Update</Button>
        <Button size="small" variant="danger" onClick={() => onDelete(post.id)}>Delete</Button>
      </div>

    </div>
  )
}
