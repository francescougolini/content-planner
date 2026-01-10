/**
 * Copyright (C) 2025-2026 Francesco Ugolini
 * ... (License remains the same)
 */

import React, { useEffect, useState, useRef } from 'react'
import { createPost, updatePost, addToList, removeFromList, getLists } from '../api.js'
import { formatISODate } from '../utils/date.js' 
import Checkbox from './Checkbox' 
import Button from './Button'
import Modal from './Modal'
import { useConfirm } from './ConfirmProvider'
import InputModal from './InputModal'
import AlertModal from './AlertModal'
import { useToast } from './ToastProvider'

// 1. RESTORED: Centralized initial state with the default 09:00 time
const initialState = (weekStart) => ({
  title: '',
  date: formatISODate(weekStart),
  time: '09:00', 
  creators: [], 
  designers: [],
  editors: [],  
  status: 'Proposed',
  platforms: [],
  notes: ''
});

export default function PostForm({ lists, onChangeLists, weekStart, editingPost, onFinished }) {
  // 2. RESTORED: Use the helper for the initial state
  const [form, setForm] = useState(initialState(weekStart));
  
  const [saving, setSaving] = useState(false)
  const [removeType, setRemoveType] = useState(null)
  const [newItemName, setNewItemName] = useState('');
  const [newColor, setNewColor] = useState('#00ff85');
  const [addType, setAddType] = useState('');
  
  const removeDialogRef = useRef(null)
  const addDialogRef = useRef(null);
  const alertRef = useRef(null);
  const inputModalRef = useRef(null);
  const toast = useToast();
  const confirm = useConfirm();

  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  const isAdmin = currentUser && currentUser.role === 'admin';

  // 3. FIXED: Properly closed function (no stray button tag)
  function genUniqueColor(existing = []) {
    const used = new Set((existing || []).map(s => (typeof s === 'object' ? (s.color || '').toLowerCase() : '').toLowerCase()));
    const palette = ['#00ff85','#ffd400','#ff6b6b','#6bc6ff','#b28bff','#ffd0b3','#9be89d','#ff9de6'];
    for (const c of palette) if (!used.has(c.toLowerCase())) return c;
    let c;
    do {
      const r = Math.floor(120 + Math.random()*135).toString(16).padStart(2,'0');
      const g = Math.floor(120 + Math.random()*135).toString(16).padStart(2,'0');
      const b = Math.floor(120 + Math.random()*135).toString(16).padStart(2,'0');
      c = `#${r}${g}${b}`;
    } while (used.has(c.toLowerCase()));
    return c;
  }

  const handleAddSuccess = (type, value) => {
    toast(`${value} added to ${type}`, 'success');
  }
  
  const openRemoveModal = (type) => {
    setRemoveType(type)
    removeDialogRef.current?.showModal()
  }

  const closeRemoveModal = () => {
    removeDialogRef.current?.close()
    setRemoveType(null)
  }

  const handleRemove = async (itemValue) => {
    confirm(`Remove "${itemValue}"?`, async () => {
      await removeFromList(removeType, itemValue)
      const updated = await getLists()
      onChangeLists(updated)
      closeRemoveModal()
    }, 'Remove item')
  }

  const getItemString = (item) => {
    if (typeof item === 'string') return item;
    return item?.value || item?.name || '';
  };
  
  const openAddModal = (type) => {
    setAddType(type);
    setNewItemName('');
    if (type === 'statuses') setNewColor(genUniqueColor(lists.statuses));
    addDialogRef.current.showModal();
  };

  const closeAddModal = () => addDialogRef.current.close();

  const handleAddConfirm = async () => {
    if (!newItemName.trim()) {
      toast('Please enter a name', 'warning');
      return;
    }
    await addListItem();
    closeAddModal();
  };
  
  useEffect(() => {
    if (editingPost) {
      setForm(editingPost)
    } else {
      setForm(initialState(weekStart));
    }
  }, [editingPost, weekStart])
  
  function updateField(k, v) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingPost) {
        await updatePost(editingPost.id, form)
      } else {
        await createPost(form)
        setForm(initialState(weekStart));
      }
      onFinished();
    } catch (err) {
      console.error('Failed to save post', err);
      alertRef.current?.show('Save failed: ' + (err.message || String(err)), 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function addListItem() {
    const textValue = newItemName.trim();
    const type = addType;
    const exists = (lists[type] || []).some(item => getItemString(item).toLowerCase() === textValue.toLowerCase());

    if (exists) {
      toast("This item already exists!", 'warning');
      return;
    }

    try {
      const payload = type === 'statuses' ? { value: textValue, color: newColor } : { value: textValue };
      await addToList(type, payload);
      const l = await getLists();
      onChangeLists(l);
      handleAddSuccess(type, textValue);
    } catch (err) {
      alertRef.current?.show("Backend error: " + (err.message || String(err)), 'Error');
    }
  } 

  const toggleMultiSelect = (field, value) => {
    setForm(f => {
      const currentList = f[field] || [];
      const next = currentList.includes(value) 
        ? currentList.filter(x => x !== value) 
        : [...currentList, value];
      return { ...f, [field]: next };
    });
  };

  return (
    <form className="panel" onSubmit={submit}>
      <div className="fld">
        <span>Title</span>
        <input value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="Write the post title" />
      </div>
      <div className="row">
        <div className="fld">
          <span>Date</span>
          <input type="date" value={form.date} onChange={e => updateField('date', e.target.value)} />
        </div>
        <div className="fld">
          <span>Time</span>
          <input type="time" value={form.time} onChange={e => updateField('time', e.target.value)} />
        </div>
      </div>

      {/* Re-usable List Section for Creators, Designers, Editors, Platforms */}
      {['creators', 'designers', 'editors', 'platforms'].map(type => (
        <div className="fld" key={type}>
          <span className="capitalize">{type}</span>
          <div className="checkboxes">
            {(lists[type] || []).map((item, i) => {
              const name = getItemString(item);
              return (
                <Checkbox 
                  key={`${name}-${i}`} 
                  checked={(form[type] || []).includes(name)} 
                  onChange={() => toggleMultiSelect(type, name)}
                >
                  {name}
                </Checkbox>
              );
            })}
          </div>
          {isAdmin && (
            <div className="inline">
              <Button type="button" size="small" onClick={() => openAddModal(type)}>＋</Button>
              <Button type="button" size="small" onClick={() => openRemoveModal(type)}>－</Button> 
            </div>
          )}
        </div>
      ))}

      <div className="fld">
        <span>Status</span>
        <div className="inline">
          <select value={form.status} onChange={e => updateField('status', e.target.value)}>
            {lists.statuses.map((s, i) => (
              <option key={`${getItemString(s)}-${i}`} value={getItemString(s)}>{getItemString(s)}</option>
            ))}
          </select>
          {isAdmin && (
            <>
              <Button type="button" size="small" onClick={() => openAddModal('statuses')}>＋</Button>
              <Button type="button" size="small" onClick={() => openRemoveModal('statuses')}>－</Button>
            </>
          )}
        </div>
      </div>

      <div className="fld">
        <span>Notes</span>
        <textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} rows={3} placeholder="Any additional information" />
      </div>

      <div className="actions">
        <button type="submit" disabled={saving} className="btn primary">
          {saving ? 'Saving...' : (editingPost ? 'Update' : 'Create')}
        </button>
        {editingPost && <button type="button" className="btn secondary" onClick={onFinished}>Cancel</button>}
      </div>

      {/* Modals */}
      <Modal ref={addDialogRef} title={`Add ${addType}`}>
        <div className="fld mt-15">
          <input autoFocus value={newItemName} onChange={e => setNewItemName(e.target.value)} 
                 onKeyDown={e => e.key === 'Enter' && (e.preventDefault() || handleAddConfirm())} />
        </div>
        {addType === 'statuses' && (
          <div className="fld">
            <span>Color</span>
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} />
          </div>
        )}
        <div className="inline flex-between w-full">
          <Button type="button" variant="secondary" onClick={closeAddModal}>Close</Button>
          <Button type="button" variant="primary" onClick={handleAddConfirm}>Save</Button>
        </div>
      </Modal>

      <Modal ref={removeDialogRef} title={`Remove ${removeType}`}>
        <ul className="remove-list">
          {(lists[removeType] || []).map((item, i) => (
            <li key={i} className="remove-item">
              <span>{getItemString(item)}</span>
              <Button type="button" size="small" variant="danger" onClick={() => handleRemove(getItemString(item))}>Delete</Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="secondary" onClick={closeRemoveModal}>Close</Button>
      </Modal>
      
      <InputModal ref={inputModalRef} />
      <AlertModal ref={alertRef} />
    </form>
  )
}
