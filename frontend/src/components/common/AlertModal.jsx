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

import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from './Modal';
import Button from '../ui/Button';

const AlertModal = forwardRef(function AlertModal(_, ref) {
    const modalRef = useRef(null);
    const [title, setTitle] = useState('Notice');
    const [message, setMessage] = useState('');

    const okRef = useRef(null);

    useImperativeHandle(ref, () => ({
        show: (msg, t) => {
            setMessage(msg || '');
            setTitle(t || 'Notice');
            modalRef.current?.showModal();
            setTimeout(() => okRef.current?.focus(), 0);
        },
        close: () => modalRef.current?.close(),
    }));

    return (
        <Modal ref={modalRef} title={title}>
            <div>{message}</div>
            <div className="modal-actions">
                <Button ref={okRef} variant="primary" size="small" aria-label="OK" onClick={() => modalRef.current?.close()}>
                    OK
                </Button>
            </div>
        </Modal>
    );
});

export default AlertModal;
