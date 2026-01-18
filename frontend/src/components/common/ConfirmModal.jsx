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

import React, { forwardRef, useRef, useImperativeHandle, useState } from 'react';
import Modal from './Modal';
import Button from '../ui/Button';

const ConfirmModal = forwardRef(function ConfirmModal(_, ref) {
    const modalRef = useRef(null);
    const onConfirmRef = useRef(null);
    const [message, setMessage] = useState('');
    const [title, setTitle] = useState('Confirm');
    const [loading, setLoading] = useState(false);

    const okRef = useRef(null);

    useImperativeHandle(ref, () => ({
        show: (msg, onConfirm, t) => {
            setMessage(msg || '');
            setTitle(t || 'Confirm');
            onConfirmRef.current = onConfirm;
            modalRef.current?.showModal();
            setTimeout(() => okRef.current?.focus(), 0);
        },
        close: () => modalRef.current?.close(),
    }));

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await Promise.resolve(onConfirmRef.current && onConfirmRef.current());
            modalRef.current?.close();
        } catch (err) {
            console.error('Confirm action failed:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal ref={modalRef} title={title}>
            <div>{message}</div>
            <div className="modal-actions">
                <Button variant="secondary" size="small" aria-label="Cancel" onClick={() => modalRef.current?.close()}>
                    Cancel
                </Button>
                <Button ref={okRef} variant="primary" size="small" aria-label="OK" onClick={handleConfirm} loading={loading}>
                    OK
                </Button>
            </div>
        </Modal>
    );
});

export default ConfirmModal;
