'use client';
import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { Plus, Pencil, X, Users } from 'lucide-react';

const ROLES = ['staff', 'supervisor', 'manager'];

function StaffModal({ staff, departments, onClose, onSaved }) {
  const editing = !!staff;
  const [form, setForm] = useState({
    name: staff?.name || '',
    phone_number: staff?.phone_number || '',
    department_id: staff?.departments?.id || '',
    role: staff?.role || 'staff',
    is_active: staff?.is_active ?? true,
    on_duty: staff?.on_duty ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone_number || !form.department_id) {
      setError('Name, phone and department are required.');
      return;
    }
    setSubmitting(true);
    try {
      const url = editing ? `/api/staff/${staff.id}` : '/api/staff';
      const u = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
      const parsedUser = u ? JSON.parse(u) : null;
      const adminRole = parsedUser?.role || '';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json', 
          'x-user-role': adminRole,
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY
        },
        body: JSON.stringify({ ...form, department_id: parseInt(form.department_id) }),
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
          <span className="modal-title">{editing ? 'Edit Staff' : 'Add Staff Member'}</span>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label className="field-required">Full Name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ramesh Kumar" required />
            </div>
            <div className="field">
              <label className="field-required">Phone Number</label>
              <input value={form.phone_number} onChange={e => set('phone_number', e.target.value)} placeholder="+91 98765 43210" required />
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-required">Department</label>
                <select value={form.department_id} onChange={e => set('department_id', e.target.value)} required>
                  <option value="">Select…</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Role</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            {editing && (
              <div className="field-row">
                <div className="field">
                  <label>Status</label>
                  <select value={form.is_active ? 'active' : 'inactive'} onChange={e => set('is_active', e.target.value === 'active')}>
                    <option value="active">Employed</option>
                    <option value="inactive">Terminated</option>
                  </select>
                </div>
                {form.is_active && (
                  <div className="field">
                    <label>Shift</label>
                    <select value={form.on_duty ? 'on' : 'off'} onChange={e => set('on_duty', e.target.value === 'on')}>
                      <option value="on">On Duty (Available)</option>
                      <option value="off">Off Duty (Break / Home)</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | staffObject

  const load = useCallback(async () => {
    try {
      const u = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
      const parsedUser = u ? JSON.parse(u) : null;
      const adminRole = parsedUser?.role || '';
      
      const [sr, dr] = await Promise.all([
        fetch('/api/staff', { headers: { 'x-user-role': adminRole, 'x-api-key': process.env.NEXT_PUBLIC_API_KEY } }), 
        fetch('/api/departments', { headers: { 'x-user-role': adminRole, 'x-api-key': process.env.NEXT_PUBLIC_API_KEY } })
      ]);
      const [s, d] = await Promise.all([sr.json(), dr.json()]);
      if (!sr.ok) throw new Error(s.error);
      if (!dr.ok) throw new Error(d.error);
      setStaff(s);
      setDepartments(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (saved, wasEditing) => {
    if (wasEditing) {
      setStaff(prev => prev.map(s => s.id === saved.id ? saved : s));
    } else {
      setStaff(prev => [...prev, saved]);
    }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Mark this staff member as inactive? Their task history is preserved.')) return;
    const adminRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : '';
    const res = await fetch(`/api/staff/${id}`, { method: 'DELETE', headers: { 'x-user-role': adminRole, 'x-api-key': process.env.NEXT_PUBLIC_API_KEY } });
    const data = await res.json();
    if (res.ok) setStaff(prev => prev.map(s => s.id === id ? { ...s, is_active: false } : s));
    else alert('Error: ' + data.error);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <header className="page-header">
          <div>
            <div className="page-header-title">Staff Management</div>
            <div className="page-header-sub">Hotel employees and assignments</div>
          </div>
          <button className="btn btn-primary" onClick={() => setModal('create')}>
            <Plus size={16} /> Add Staff
          </button>
        </header>

        <main className="page-body">
          {error && <div className="error-banner">{error}</div>}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Users size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                All Staff ({staff.length})
              </span>
            </div>
            {loading ? (
              <div className="loading-wrap"><div className="spinner" /> Loading…</div>
            ) : staff.length === 0 ? (
              <div className="empty-state"><Users size={40} /><p>No staff added yet.</p></div>
            ) : (
              <>
                {/* Desktop view */}
                <div className="table-wrapper desktop-only">
                  <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Department</th>
                      <th>Role</th>
                      <th>Shift Duty</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(s => (
                      <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.55 }}>
                        <td><strong style={{ fontWeight: 600 }}>{s.name}</strong></td>
                        <td className="td-muted">{s.phone_number}</td>
                        <td className="td-muted">{s.departments?.name || '—'}</td>
                        <td>
                          <span className="badge badge-normal" style={{ textTransform: 'capitalize' }}>
                            {s.role}
                          </span>
                        </td>
                        <td>
                          {s.is_active ? (
                            <button 
                              className={`badge ${s.on_duty ? 'badge-completed' : 'badge-normal'}`} 
                              onClick={async () => {
                                const adminRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : '';
                                const res = await fetch(`/api/staff/${s.id}`, {
                                  method: 'PUT',
                                  headers: { 
                                    'Content-Type': 'application/json', 
                                    'x-user-role': adminRole,
                                    'x-api-key': process.env.NEXT_PUBLIC_API_KEY
                                  },
                                  body: JSON.stringify({ on_duty: !s.on_duty })
                                });
                                if (res.ok) setStaff(prev => prev.map(st => st.id === s.id ? { ...st, on_duty: !s.on_duty } : st));
                              }}
                              style={{ cursor: 'pointer', border: 'none' }}
                            >
                              <span className="badge-dot" style={{ background: s.on_duty ? '#16a34a' : '#64748b' }} />
                              {s.on_duty ? 'On Duty' : 'Off Duty'}
                            </button>
                          ) : <span className="td-muted">—</span>}
                        </td>
                        <td>
                          <span className={`badge ${s.is_active ? 'badge-completed' : 'badge-urgent'}`}>
                            <span className="badge-dot" style={{ background: s.is_active ? '#16a34a' : '#dc2626' }} />
                            {s.is_active ? 'Employed' : 'Terminated'}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => setModal(s)}>
                              <Pencil size={13} /> Edit
                            </button>
                            {s.is_active && (
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(s.id)}>
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile view */}
              <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {staff.map(s => (
                  <div key={s.id} className="card" style={{ padding: '16px', opacity: s.is_active ? 1 : 0.6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{s.name}</div>
                        <div className="td-muted" style={{ fontSize: '0.8rem', marginTop: '2px' }}>{s.phone_number}</div>
                      </div>
                      <span className={`badge ${s.is_active ? 'badge-completed' : 'badge-urgent'}`}>
                        <span className="badge-dot" style={{ background: s.is_active ? '#16a34a' : '#dc2626' }} />
                        {s.is_active ? 'Employed' : 'Terminated'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '0.85rem' }}>
                      <div>
                        <div className="td-muted" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Department</div>
                        <div style={{ fontWeight: 600 }}>{s.departments?.name || '—'}</div>
                      </div>
                      <div>
                        <div className="td-muted" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Role</div>
                        <div style={{ textTransform: 'capitalize', fontWeight: 600 }}>{s.role}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        {s.is_active ? (
                          <button 
                            className={`badge ${s.on_duty ? 'badge-completed' : 'badge-normal'}`} 
                            onClick={async () => {
                              const adminRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : '';
                              const res = await fetch(`/api/staff/${s.id}`, {
                                method: 'PUT',
                                headers: { 
                                  'Content-Type': 'application/json', 
                                  'x-user-role': adminRole,
                                  'x-api-key': process.env.NEXT_PUBLIC_API_KEY
                                },
                                body: JSON.stringify({ on_duty: !s.on_duty })
                              });
                              if (res.ok) setStaff(prev => prev.map(st => st.id === s.id ? { ...st, on_duty: !s.on_duty } : st));
                            }}
                            style={{ cursor: 'pointer', border: 'none', padding: '6px 12px' }}
                          >
                            <span className="badge-dot" style={{ background: s.on_duty ? '#16a34a' : '#64748b' }} />
                            {s.on_duty ? 'On Duty' : 'Off Duty'}
                          </button>
                        ) : <span className="td-muted" style={{ fontSize: '0.8rem' }}>Not active</span>}
                      </div>

                      <div className="row-actions" style={{ gap: '8px' }}>
                        {s.is_active && (
                          <button className="btn btn-danger btn-icon" onClick={() => handleDeactivate(s.id)}>
                            <X size={14} />
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal(s)}>
                          <Pencil size={13} /> Edit
                        </button>
                      </div>
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
        <StaffModal
          staff={modal === 'create' ? null : modal}
          departments={departments}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
