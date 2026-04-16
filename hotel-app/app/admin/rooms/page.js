'use client';
import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import MobileHeader from '@/components/MobileHeader';
import { Plus, Pencil, Trash2, X, DoorOpen } from 'lucide-react';

function RoomModal({ room, onClose, onSaved }) {
  const editing = !!room;
  const [form, setForm] = useState({
    room_number: room?.room_number || '',
    floor: room?.floor ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.room_number) { setError('Room number is required.'); return; }
    setSubmitting(true);
    try {
      const url = editing ? `/api/rooms/${room.id}` : '/api/rooms';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY
        },
        body: JSON.stringify({
          room_number: form.room_number,
          floor: form.floor !== '' ? parseInt(form.floor) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data, editing);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{editing ? 'Edit Room' : 'Add Room'}</span>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">{error}</div>}
            <div className="field-row">
              <div className="field">
                <label className="field-required">Room Number</label>
                <input
                  value={form.room_number}
                  onChange={e => set('room_number', e.target.value)}
                  placeholder="e.g. 101"
                  required
                />
              </div>
              <div className="field">
                <label>Floor</label>
                <input
                  type="number"
                  value={form.floor}
                  onChange={e => set('floor', e.target.value)}
                  placeholder="e.g. 1"
                  min="0"
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Add Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms', { headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load rooms');
      setRooms(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (saved, wasEditing) => {
    if (wasEditing) {
      setRooms(prev => prev.map(r => r.id === saved.id ? saved : r));
    } else {
      setRooms(prev => [...prev, saved].sort((a, b) => a.room_number.localeCompare(b.room_number)));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this room? This will fail if tasks reference it.')) return;
    const res = await fetch(`/api/rooms/${id}`, { 
      method: 'DELETE',
      headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY }
    });
    const data = await res.json();
    if (res.ok) setRooms(prev => prev.filter(r => r.id !== id));
    else alert('Error: ' + data.error);
  };

  // Group rooms by floor
  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => (a ?? 0) - (b ?? 0));

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        {/* Mobile Header */}
        <MobileHeader title="Rooms" subtitle="Hotel rooms" />

        <header className="page-header desktop-only">
          <div>
            <div className="page-header-title">Room Management</div>
            <div className="page-header-sub">Hotel rooms available for service requests</div>
          </div>
          <button className="btn btn-primary" onClick={() => setModal('create')}>
            <Plus size={16} /> Add Room
          </button>
        </header>

        <main className="page-body">
          {error && <div className="error-banner">{error}</div>}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <DoorOpen size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                All Rooms ({rooms.length})
              </span>
            </div>
            {loading ? (
              <div className="loading-wrap"><div className="spinner" /> Loading…</div>
            ) : rooms.length === 0 ? (
              <div className="empty-state"><DoorOpen size={40} /><p>No rooms added yet.</p></div>
            ) : (
              <>
                <div className="table-wrapper desktop-only">
                  <table>
                  <thead>
                    <tr>
                      <th>Room Number</th>
                      <th>Floor</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map(r => (
                      <tr key={r.id}>
                        <td>
                          <strong style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            Room {r.room_number}
                          </strong>
                        </td>
                        <td className="td-muted">
                          {r.floor != null ? `Floor ${r.floor}` : '—'}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => setModal(r)}>
                              <Pencil size={13} /> Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile view */}
              <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {rooms.map(r => (
                  <div key={r.id} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        Room {r.room_number}
                      </div>
                      <div className="td-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                        {r.floor != null ? `Floor ${r.floor}` : 'No floor assigned'}
                      </div>
                    </div>
                    
                    <div className="row-actions" style={{ gap: '8px' }}>
                      <button className="btn btn-ghost btn-icon" onClick={() => setModal(r)}>
                        <Pencil size={15} />
                      </button>
                      <button className="btn btn-danger btn-icon" onClick={() => handleDelete(r.id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
            )}
          </div>
        </main>
      </div>

      {modal && (
        <RoomModal
          room={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
