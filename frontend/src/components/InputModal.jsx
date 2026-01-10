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
 
import React, { forwardRef, useRef, useImperativeHandle, useState } from 'react'
import Modal from './Modal'
import Button from './Button'

const InputModal = forwardRef(function InputModal(_, ref) {
  const modalRef = useRef(null)
  const onConfirmRef = useRef(null)
  const [title, setTitle] = useState('Input')
  const [message, setMessage] = useState('')
  const [value, setValue] = useState('')

  const inputRef = useRef(null)
  const okRef = useRef(null)

  useImperativeHandle(ref, () => ({

    show: (msg, defaultValue, onConfirm, t) => {
      setMessage(msg || '')
      setValue(defaultValue || '')
      setTitle(t || 'Input')
      onConfirmRef.current = onConfirm
      modalRef.current?.showModal()
      setTimeout(() => inputRef.current?.focus(), 0)
    },
    close: () => modalRef.current?.close()
  }))

  const handleConfirm = async (val) => {
    const v = (val !== undefined ? val : value).trim();
    if (!v) return;
    try {
      await Promise.resolve(onConfirmRef.current && onConfirmRef.current(v));
    } finally {
      modalRef.current?.close();
    }
  };

  return (
    <Modal ref={modalRef} title={title}>
      <div className="modal-body">{message}</div>
      <input 
        ref={inputRef} 
        value={value} 
        onChange={e => setValue(e.target.value)} 
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const trimmedValue = (e.target.value || '').trim();
            if (trimmedValue) handleConfirm(trimmedValue);
          }
        }}
        autoFocus 
        aria-label={title || 'Input'}
      />
      <div className="modal-actions">
        <Button variant="secondary" size="small" onClick={() => modalRef.current?.close()}>Cancel</Button>
        <Button ref={okRef} variant="primary" size="small" onClick={handleConfirm}>OK</Button>
      </div>
    </Modal>
  )
})

export default InputModal
