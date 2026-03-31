'use client';
import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { Plus, Pencil, Trash2, X, Building2 } from 'lucide-react';

function DeptModal({ dept, allStaff, onClose, onSaved }) {
  const editing = !!dept;
  const [form, setForm] = useState({
    name: dept?.name || '',
    description: dept?.description || '',
    default_staff_id: dept?.staff?.id || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { setError('Department name is required.'); return; }
    setSubmitting(true);
    try {
      const url = editing ? `/api/departments/${dept.id}` : '/api/departments';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY
        },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          default_staff_id: form.default_staff_id ? parseInt(form.default_staff_id) : null,
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
          <span className="modal-title">{editing ? 'Edit Department' : 'Add Department'}</span>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label className="field-required">Department Name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. housekeeping" required />
            </div>
            <div className="field">
              <label>Description</label>
              <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description…" />
            </div>
            <div className="field">
              <label>Default Assigned Staff</label>
              <select value={form.default_staff_id} onChange={e => set('default_staff_id', e.target.value)}>
                <option value="">None (assign manually)</option>
                {allStaff.filter(s => s.is_active).map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.departments?.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    try {
      const [dr, sr] = await Promise.all([
        fetch('/api/departments', { headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY } }), 
        fetch('/api/staff', { headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY } })
      ]);
      const [d, s] = await Promise.all([dr.json(), sr.json()]);
      if (!dr.ok) throw new Error(d.error);
      if (!sr.ok) throw new Error(s.error);
      setDepartments(d);
      setAllStaff(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (saved, wasEditing) => {
    if (wasEditing) {
      setDepartments(prev => prev.map(d => d.id === saved.id ? saved : d));
    } else {
      setDepartments(prev => [...prev, saved]);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this department? This cannot be undone.')) return;
    const res = await fetch(`/api/departments/${id}`, { 
      method: 'DELETE',
      headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY } 
    });
    const data = await res.json();
    if (res.ok) setDepartments(prev => prev.filter(d => d.id !== id));
    else alert('Error: ' + data.error);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <header className="page-header">
          <div>
            <div className="page-header-title">Department Management</div>
            <div className="page-header-sub">Service departments & default staff assignments</div>
          </div>
          <button className="btn btn-primary" onClick={() => setModal('create')}>
            <Plus size={16} /> Add Department
          </button>
        </header>

        <main className="page-body">
          {error && <div className="error-banner">{error}</div>}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Building2 size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Departments ({departments.length})
              </span>
            </div>
            {loading ? (
              <div className="loading-wrap"><div className="spinner" /> Loading…</div>
            ) : departments.length === 0 ? (
              <div className="empty-state"><Building2 size={40} /><p>No departments yet.</p></div>
            ) : (
              <>
                <div className="table-wrapper desktop-only">
                  <table>
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Description</th>
                      <th>Default Staff</th>
                      <th>Phone</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map(d => (
                      <tr key={d.id}>
                        <td><strong style={{ fontWeight: 600, textTransform: 'capitalize' }}>{d.name}</strong></td>
                        <td className="td-muted">{d.description || '—'}</td>
                        <td>
                          {d.staff ? (
                            <span className="badge badge-completed">{d.staff.name}</span>
                          ) : (
                            <span className="td-muted">Not assigned</span>
                          )}
                        </td>
                        <td className="td-muted">{d.staff?.phone_number || '—'}</td>
                        <td>
                          <div className="row-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => setModal(d)}>
                              <Pencil size={13} /> Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d.id)}>
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
              <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {departments.map(d => (
                  <div key={d.id} className="card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontWeight: 700, fontSize: '1rem', textTransform: 'capitalize' }}>{d.name}</strong>
                    </div>
                    {d.description && (
                      <div className="td-muted" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>{d.description}</div>
                    )}
                    
                    <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: '8px', marginBottom: '16px' }}>
                      <div className="td-muted" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Default Staff</div>
                      {d.staff ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '2px' }}>{d.staff.name}</div>
                          <div className="td-muted" style={{ fontSize: '0.8rem' }}>{d.staff.phone_number}</div>
                        </div>
                      ) : (
                        <div className="td-muted" style={{ fontSize: '0.85rem' }}>Not assigned</div>
                      )}
                    </div>

                    <div className="row-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(d)}>
                        <Pencil size={13} /> Edit
                      </button>
                      <button className="btn btn-danger btn-icon" onClick={() => handleDelete(d.id)}>
                        <Trash2 size={14} />
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
        <DeptModal
          dept={modal === 'create' ? null : modal}
          allStaff={allStaff}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
