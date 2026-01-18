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
import Modal from './Modal.jsx';
import Button from '../ui/Button';
import AlertModal from './AlertModal.jsx';
import { formatISODate, addDays } from '../../utils/date.js';

const ExportModal = forwardRef(function ExportModal({ weekStart }, ref) {
    const modalRef = useRef(null);
    const alertRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [rangeType, setRangeType] = useState('this_week');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    useImperativeHandle(ref, () => ({
        show: () => {
            setRangeType('this_week');
            setCustomStart('');
            setCustomEnd('');
            setLoading(false);
            modalRef.current?.showModal();
        },
        close: () => modalRef.current?.close(),
    }));

    const handleExport = async () => {
        setLoading(true);
        try {
            let dateFrom, dateTo;

            if (rangeType === 'this_week') {
                dateFrom = formatISODate(weekStart);
                dateTo = formatISODate(addDays(weekStart, 6));
            } else if (rangeType === 'next_week') {
                const nextWeekStart = addDays(weekStart, 7);
                dateFrom = formatISODate(nextWeekStart);
                dateTo = formatISODate(addDays(nextWeekStart, 6));
            } else if (rangeType === 'custom') {
                if (!customStart || !customEnd) {
                    // [3] Use alertRef instead of window.alert
                    alertRef.current?.show('Please select both start and end dates', 'Validation Error');
                    setLoading(false);
                    return;
                }
                dateFrom = customStart;
                dateTo = customEnd;
            }

            const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
            const user = JSON.parse(localStorage.getItem('user'));
            const headers = {};

            if (user && user.username) {
                headers['x-user-username'] = user.username;
            }

            // Build the query string with dateFrom and dateTo
            const params = new URLSearchParams({ dateFrom, dateTo });
            const url = `${BASE}/export/csv?${params.toString()}`;

            const response = await fetch(url, {
                method: 'GET',
                headers,
                credentials: 'include',
            });

            if (response.status === 401) {
                localStorage.removeItem('user');
                window.location.reload();
                return;
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Export failed');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `posts-export-${dateFrom}-to-${dateTo}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);

            modalRef.current?.close();
        } catch (err) {
            console.error('Export error:', err);
            alertRef.current?.show('Export failed: ' + (err.message || String(err)), 'Export Error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal ref={modalRef} title="Export to CSV">
            <div className="fld">
                <span>Date Range</span>
                <select value={rangeType} onChange={(e) => setRangeType(e.target.value)} disabled={loading}>
                    <option value="this_week">This Week</option>
                    <option value="next_week">Next Week</option>
                    <option value="custom">Custom Range</option>
                </select>
            </div>

            {rangeType === 'custom' && (
                <>
                    <div className="fld">
                        <span>Start Date</span>
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <div className="fld">
                        <span>End Date</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                </>
            )}

            <div className="modal-actions">
                <Button variant="secondary" size="small" onClick={() => modalRef.current?.close()} disabled={loading}>
                    Cancel
                </Button>
                <Button variant="primary" size="small" onClick={handleExport} loading={loading}>
                    Export
                </Button>
            </div>

            <AlertModal ref={alertRef} />
        </Modal>
    );
});

export default ExportModal;
