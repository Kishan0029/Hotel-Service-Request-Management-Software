'use client';
import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { Plus, Pencil, Trash2, X, MapPin } from 'lucide-react';

function LocationModal({ location, onClose, onSaved }) {
  const editing = !!location;
  const [form, setForm] = useState({
    name:  location?.name || '',
    type:  location?.type || 'area',
    floor: location?.floor ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { setError('Name is required.'); return; }
    setSubmitting(true);
    try {
      const url = editing ? `/api/locations/${location.id}` : '/api/locations';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY
        },
        body: JSON.stringify({
          name:  form.name,
          type:  form.type,
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
          <span className="modal-title">{editing ? 'Edit Location' : 'Add Location'}</span>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">{error}</div>}
            
            <div className="field">
              <label className="field-required">Name / Number</label>
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Lobby, Room 101, Pool Area"
                required
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-required">Type</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} required>
                  <option value="area">Hotel Area (General)</option>
                  <option value="room">Room (Guest Unit)</option>
                </select>
              </div>
              <div className="field">
                <label>Floor (Optional)</label>
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
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Add Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LocationsAdminPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/locations', { headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load locations');
      setLocations(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (saved, wasEditing) => {
    if (wasEditing) {
      setLocations(prev => prev.map(l => l.id === saved.id ? saved : l));
    } else {
      setLocations(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this location? This will fail if tasks reference it.')) return;
    const res = await fetch(`/api/locations/${id}`, { 
      method: 'DELETE',
      headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY }
    });
    const data = await res.json();
    if (res.ok) setLocations(prev => prev.filter(l => l.id !== id));
    else alert('Error: ' + data.error);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <header className="page-header">
          <div>
            <div className="page-header-title">Location Management</div>
            <div className="page-header-sub">Manage Rooms and General Hotel Areas for MOD Dispatch</div>
          </div>
          <button className="btn btn-primary" onClick={() => setModal('create')}>
            <Plus size={16} /> Add Location
          </button>
        </header>

        <main className="page-body">
          {error && <div className="error-banner">{error}</div>}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <MapPin size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                All Locations ({locations.length})
              </span>
            </div>
            {loading ? (
              <div className="loading-wrap"><div className="spinner" /> Loading…</div>
            ) : locations.length === 0 ? (
              <div className="empty-state"><MapPin size={40} /><p>No locations added yet.</p></div>
            ) : (
              <>
                <div className="table-wrapper desktop-only">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Floor</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map(l => (
                        <tr key={l.id}>
                          <td>
                            <strong style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                              {l.name}
                            </strong>
                          </td>
                          <td>
                            <span className={`badge ${l.type === 'room' ? 'badge-pending' : 'badge-completed'}`} style={{ textTransform: 'capitalize' }}>
                              {l.type}
                            </span>
                          </td>
                          <td className="td-muted">
                            {l.floor != null ? `Floor ${l.floor}` : '—'}
                          </td>
                          <td>
                            <div className="row-actions">
                              <button className="btn btn-ghost btn-sm" onClick={() => setModal(l)}>
                                <Pencil size={13} /> Edit
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(l.id)}>
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
                  {locations.map(l => (
                    <div key={l.id} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                          {l.name}
                        </div>
                        <div className="td-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                          {l.type.toUpperCase()} {l.floor != null ? `· Floor ${l.floor}` : ''}
                        </div>
                      </div>
                      
                      <div className="row-actions" style={{ gap: '8px' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => setModal(l)}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn btn-danger btn-icon" onClick={() => handleDelete(l.id)}>
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
        <LocationModal
          location={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
