'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, CheckCircle2, Clock, ClipboardList,
  Flame, BarChart2, Activity, LogOut, RefreshCw, Plus, X, ArrowRight,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';

/* ── Helpers ─────────────────────────────────────────────── */
function elapsed(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function delayMins(task) {
  const el = (Date.now() - new Date(task.created_at).getTime()) / 60_000;
  return Math.max(0, Math.round(el - (task.expected_time ?? 10)));
}

function isDelayed(task) {
  if (task.status === 'completed') return false;
  return (Date.now() - new Date(task.created_at).getTime()) / 60_000 > (task.expected_time ?? 10);
}

function isToday(iso) {
  const d = new Date(iso), now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function StatusBadge({ status }) {
  const map = {
    pending:      { label: 'Pending',      cls: 'badge-pending' },
    acknowledged: { label: 'Acknowledged', cls: 'badge-acknowledged' },
    in_progress:  { label: 'In Progress',  cls: 'badge-in_progress' },
    completed:    { label: 'Completed',    cls: 'badge-completed' },
  };
  const b = map[status] ?? { label: status, cls: '' };
  return <span className={`badge ${b.cls}`}><span className="badge-dot" /> {b.label}</span>;
}

function LevelBadge({ level }) {
  if (!level) return null;
  const map = {
    manager:    { label: 'Manager',    cls: 'badge-level-manager' },
    supervisor: { label: 'Supervisor', cls: 'badge-level-supervisor' },
    staff:      { label: 'Staff',      cls: 'badge-level-staff' },
  };
  const b = map[level];
  if (!b) return null;
  return <span className={`badge badge-level ${b.cls}`}>{b.label}</span>;
}

/* ── Stat Card ───────────────────────────────────────────── */
function StatCard({ label, value, color, icon }) {
  return (
    <div className="gm-stat-card">
      <div className="gm-stat-icon">{icon}</div>
      <div>
        <div className="gm-stat-value" style={{ color }}>{value}</div>
        <div className="gm-stat-label">{label}</div>
      </div>
    </div>
  );
}

// Dept → default task types
const DEPT_TASK_TYPES = {
  'Housekeeping': ['Room Cleaning', 'Towels', 'Extra Pillows', 'Extra Blanket', 'Bed Making', 'Trash Removal', 'Turndown Service'],
  'Laundry':      ['Laundry Pickup', 'Dry Cleaning', 'Express Laundry', 'Ironing', 'Laundry Return', 'Stain Treatment'],
  'Bell Desk':    ['Luggage Assistance', 'Wake-up Call', 'Taxi Booking', 'Parcel Delivery', 'Guest Arrival', 'Guest Departure'],
  'Maintenance':  ['AC Not Working', 'Light Bulb Fix', 'Plumbing Issue', 'TV / Remote Issue', 'Door Lock Issue', 'Water Leakage', 'Safe Not Opening'],
};
const FALLBACK_TASK_TYPES = ['Room Service', 'Water Bottles', 'Minibar Refill', 'Other'];

/* ── GM Create Task Modal ────────────────────────────────── */
function GMCreateTaskModal({ rooms, departments, managers, onClose, onCreated, gmUser }) {
  const [form, setForm] = useState({
    room_id: '', department_id: '', task_type: '', task_type_custom: '',
    priority: 'normal', type: 'request', notes: '', initial_manager_id: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Filter managers by selected department
  const managersInDept = managers.filter(m =>
    !form.department_id || String(m.department_id) === String(form.department_id)
  );

  const deptName = departments.find(d => String(d.id) === String(form.department_id))?.name;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const taskType = form.task_type === '__custom__' ? form.task_type_custom : form.task_type;
    if (!form.room_id || !form.department_id || !taskType) {
      setError('Room, Department, and Task Type are required.'); return;
    }
    if (!form.initial_manager_id) {
      setError('Please select a manager to assign this task to.'); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY 
        },
        body: JSON.stringify({
          room_id:            parseInt(form.room_id),
          department_id:      parseInt(form.department_id),
          task_type:          taskType,
          priority:           form.priority,
          type:               form.type,
          notes:              form.notes || undefined,
          created_by:         gmUser?.name ?? 'GM',
          creator_role:       'gm',
          initial_manager_id: parseInt(form.initial_manager_id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create task');
      onCreated(data);
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
          <span className="modal-title">🏨 New Task — GM Assignment</span>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">{error}</div>}
            {/* Type */}
            <div className="field">
              <label className="field-required">Type</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['request', 'complaint'].map(t => (
                  <label key={t} className={`type-radio ${form.type === t ? `type-radio-${t}` : ''}`}>
                    <input type="radio" name="type" value={t} checked={form.type === t} onChange={() => set('type', t)} style={{ display: 'none' }} />
                    {t === 'complaint' ? '⚠ Complaint' : '📋 Request'}
                  </label>
                ))}
              </div>
            </div>
            {/* Room + Dept */}
            <div className="field-row">
              <div className="field">
                <label className="field-required">Room</label>
                <select value={form.room_id} onChange={e => set('room_id', e.target.value)} required>
                  <option value="">Select room…</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number} (Fl. {r.floor})</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-required">Department</label>
                <select value={form.department_id} onChange={e => { set('department_id', e.target.value); set('task_type', ''); set('initial_manager_id', ''); }} required>
                  <option value="">Select dept…</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            {/* Task Type */}
            <div className="field">
              <label className="field-required">Task Type</label>
              <select value={form.task_type} onChange={e => set('task_type', e.target.value)} required disabled={!form.department_id}>
                <option value="">{form.department_id ? 'Select task type…' : 'Select department first…'}</option>
                {(DEPT_TASK_TYPES[deptName] ?? FALLBACK_TASK_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                <option value="__custom__">Other (specify below)…</option>
              </select>
            </div>
            {form.task_type === '__custom__' && (
              <div className="field">
                <label className="field-required">Describe Task</label>
                <input type="text" placeholder="e.g. Special setup" value={form.task_type_custom} onChange={e => set('task_type_custom', e.target.value)} required />
              </div>
            )}
            {/* Assign to Manager */}
            <div className="field">
              <label className="field-required">Assign to Manager</label>
              <select value={form.initial_manager_id} onChange={e => set('initial_manager_id', e.target.value)} required>
                <option value="">
                  {form.department_id
                    ? (managersInDept.length ? 'Select manager…' : 'No managers in this dept')
                    : 'Select department first…'}
                </option>
                {managersInDept.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            {/* Priority + Notes */}
            <div className="field-row">
              <div className="field">
                <label>Priority</label>
                <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Notes (optional)</label>
              <textarea placeholder="Additional context for the manager…" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : <><ArrowRight size={14} /> Assign to Manager</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── GM Dashboard ────────────────────────────────────────── */
export default function GmDashboard() {
  const router = useRouter();
  const [user, setUser]               = useState(null);
  const [tasks, setTasks]             = useState([]);
  const [departments, setDepartments] = useState([]);
  const [rooms, setRooms]             = useState([]);
  const [allStaff, setAllStaff]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showCreate, setShowCreate]   = useState(false);

  // Auth guard
  useEffect(() => {
    try {
      const u = localStorage.getItem('currentUser');
      if (!u) { router.replace('/login'); return; }
      const parsed = JSON.parse(u);
      if (parsed.role !== 'gm') { router.replace('/'); return; }
      setUser(parsed);
    } catch { router.replace('/login'); }
  }, [router]);

  const loadData = useCallback(async () => {
    try {
      const headers = { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY };
      const [tr, dr, rr, sr] = await Promise.all([
        fetch('/api/tasks?role=gm', { headers }),
        fetch('/api/departments', { headers }),
        fetch('/api/rooms', { headers }),
        fetch('/api/staff', { headers }),
      ]);
      const [t, d, r, s] = await Promise.all([tr.json(), dr.json(), rr.json(), sr.json()]);
      if (!tr.ok) throw new Error(t.error || 'Failed to load GM data');
      setTasks(Array.isArray(t) ? t : []);
      setDepartments(Array.isArray(d) ? d : []);
      setRooms(Array.isArray(r) ? r : []);
      setAllStaff(Array.isArray(s) ? s.filter(x => x.is_active) : []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => { if (user) loadData(); }, 30_000);
    return () => clearInterval(id);
  }, [user, loadData]);

  const logout = () => {
    localStorage.removeItem('currentUser');
    router.push('/login');
  };

  const handleCreated = (task) => {
    setTasks(prev => [task, ...prev]);
  };

  if (!user || loading) {
    return (
      <div className="login-shell">
        <div className="login-loading"><div className="spinner" /><span>Loading GM Dashboard…</span></div>
      </div>
    );
  }

  /* ── Managers (for create modal) ─────────────────────────── */
  const managers = allStaff.filter(s => s.role === 'manager');

  /* ── Computed stats ──────────────────────────────────────── */
  const todayTasks = tasks.filter(t => isToday(t.created_at));
  const pending    = tasks.filter(t => t.status !== 'completed');
  const delayed    = pending.filter(isDelayed);
  const complaints = pending.filter(t => t.type === 'complaint');
  const escalated  = pending.filter(t => t.escalation_level >= 1);

  // Count tasks by current_level
  const atManager    = pending.filter(t => t.current_level === 'manager').length;
  const atSupervisor = pending.filter(t => t.current_level === 'supervisor').length;
  const atStaff      = pending.filter(t => t.current_level === 'staff').length;

  // Department performance
  const deptStats = departments.map(d => {
    const dTasks     = tasks.filter(t => t.departments?.id === d.id);
    const dToday     = dTasks.filter(t => isToday(t.created_at));
    const dCompleted = dTasks.filter(t => t.status === 'completed');
    const dDelayed   = dTasks.filter(t => t.status !== 'completed' && isDelayed(t));
    return {
      id:        d.id,
      name:      d.name,
      total:     dToday.length,
      completed: dCompleted.filter(t => isToday(t.created_at)).length,
      delayed:   dDelayed.length,
    };
  }).filter(d => d.total > 0 || d.delayed > 0);

  // Recent activity: last 20 events across all tasks
  const recentActivity = [];
  for (const task of tasks) {
    const log = Array.isArray(task.activity_log) ? task.activity_log : [];
    for (const entry of log) {
      recentActivity.push({ ...entry, task_code: task.task_code, task_type: task.task_type, room: task.rooms?.room_number, current_level: task.current_level });
    }
  }
  recentActivity.sort((a, b) => new Date(b.time) - new Date(a.time));
  const recentSlice = recentActivity.slice(0, 20);

  const activityIcon = { created: '📋', acknowledged: '✅', started: '🔧', completed: '✓', reassigned: '↩', escalated: '🔴', assigned: '→' };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        {error && <div className="error-banner" style={{ margin: 20 }}>{error}</div>}
        <header className="page-header">
          <div>
            <div className="page-header-title">GM Dashboard Overview</div>
            <div className="page-header-sub">Property-wide oversight</div>
          </div>
          <div className="header-actions">
            {lastRefresh && (
              <span className="gm-refresh-time" style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                Updated {elapsed(lastRefresh)}
              </span>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> New Task
            </button>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        </header>

      <main className="gm-main">
        {/* ── Summary Stats ───────────────────────────── */}
        <div className="gm-stats-grid">
          <StatCard label="Today"      value={todayTasks.length} color="#1d4ed8" icon={<ClipboardList size={22} />} />
          <StatCard label="Pending"    value={pending.length}    color="#b45309" icon={<Clock size={22} />} />
          <StatCard label="Delayed"    value={delayed.length}    color="#c2410c" icon={<AlertTriangle size={22} />} />
          <StatCard label="Complaints" value={complaints.length} color="#b91c1c" icon={<Flame size={22} />} />
          <StatCard label="Escalated"  value={escalated.length}  color="#c2410c" icon={<AlertTriangle size={22} />} />
        </div>

        {/* ── Chain Level Overview ─────────────────────── */}
        <div className="gm-chain-bar">
          <div className="gm-chain-item">
            <span className="badge badge-level badge-level-manager">{atManager}</span>
            <span className="gm-chain-label">At Manager</span>
          </div>
          <div className="gm-chain-arrow">→</div>
          <div className="gm-chain-item">
            <span className="badge badge-level badge-level-supervisor">{atSupervisor}</span>
            <span className="gm-chain-label">At Supervisor</span>
          </div>
          <div className="gm-chain-arrow">→</div>
          <div className="gm-chain-item">
            <span className="badge badge-level badge-level-staff">{atStaff}</span>
            <span className="gm-chain-label">At Staff</span>
          </div>
        </div>

        <div className="gm-content-grid">
          {/* ── Left Column ─────────────────────────── */}
          <div className="gm-left">

            {/* Active Complaints */}
            <div className="gm-section">
              <div className="gm-section-title">
                <Flame size={15} color="#dc2626" /> Active Complaints ({complaints.length})
              </div>
              <div className="gm-list">
                {complaints.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px 24px' }}>
                    <CheckCircle2 size={32} />
                    <p>No complaints at the moment</p>
                  </div>
                ) : (
                  complaints.map(t => (
                    <div key={t.id} className={`gm-list-item ${t.escalation_level > 0 ? 'gm-item-critical' : 'gm-item-complaint'}`}>
                      <div className="gm-item-header">
                        <strong>Room {t.rooms?.room_number}</strong>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <LevelBadge level={t.current_level} />
                          <StatusBadge status={t.status} />
                        </div>
                      </div>
                      <div className="gm-item-body">
                        {t.departments?.name} — {t.task_type}
                        {t.notes && <span className="td-muted"> · {t.notes}</span>}
                      </div>
                      <div className="gm-item-footer">
                        {isDelayed(t) && <span className="sla-delayed">⚠ Delayed {delayMins(t)}m</span>}
                        {t.escalation_level >= 1 && <span className="badge badge-critical">🔴 Escalated</span>}
                        <span className="td-muted">{elapsed(t.created_at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Delayed Tasks */}
            <div className="gm-section">
              <div className="gm-section-title">
                <AlertTriangle size={15} color="#dc2626" /> Delayed Tasks ({delayed.length})
              </div>
              <div className="gm-list">
                {delayed.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px 24px' }}>
                    <CheckCircle2 size={32} />
                    <p>All tasks are on time</p>
                  </div>
                ) : (
                  delayed.sort((a, b) => delayMins(b) - delayMins(a)).map(t => (
                    <div key={t.id} className={`gm-list-item ${t.escalation_level >= 2 ? 'gm-item-critical' : t.escalation_level === 1 ? 'gm-item-escalated' : 'gm-item-delayed'}`}>
                      <div className="gm-item-header">
                        <strong>Room {t.rooms?.room_number}</strong>
                        <span className="sla-delayed">+{delayMins(t)}m over SLA</span>
                      </div>
                      <div className="gm-item-body">
                        {t.departments?.name} — {t.task_type}
                      </div>
                      <div className="gm-item-footer">
                        <LevelBadge level={t.current_level} />
                        <StatusBadge status={t.status} />
                        {t.assigned_staff?.name && <span className="td-muted">→ {t.assigned_staff.name}</span>}
                        {t.escalation_level >= 1 && <span className="badge badge-escalated">Escalated</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Right Column ─────────────────────────── */}
          <div className="gm-right">

            {/* Department Performance */}
            <div className="gm-section">
              <div className="gm-section-title">
                <BarChart2 size={15} /> Department Performance
              </div>
              {deptStats.length === 0 ? (
                <p className="td-muted" style={{ padding: '12px 16px' }}>No tasks today.</p>
              ) : (
                <table className="gm-dept-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Today</th>
                      <th>Done</th>
                      <th>Delayed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptStats.map(d => (
                      <tr key={d.id}>
                        <td>{d.name}</td>
                        <td>{d.total}</td>
                        <td style={{ color: '#16a34a' }}>{d.completed}</td>
                        <td style={{ color: d.delayed > 0 ? '#dc2626' : 'inherit', fontWeight: d.delayed > 0 ? 700 : 400 }}>
                          {d.delayed > 0 ? `${d.delayed} ⚠` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Recent Activity */}
            <div className="gm-section">
              <div className="gm-section-title">
                <Activity size={15} /> Recent Activity
              </div>
              {recentSlice.length === 0 ? (
                <p className="td-muted" style={{ padding: '12px 16px' }}>No activity yet.</p>
              ) : (
                <div className="gm-activity-feed">
                  {recentSlice.map((entry, i) => (
                    <div key={i} className="gm-activity-item">
                      <span className="gm-activity-icon">{activityIcon[entry.event] ?? '•'}</span>
                      <div className="gm-activity-body">
                        <span className="gm-activity-event">
                          {entry.task_code} — {entry.event}
                          {entry.by && entry.by !== 'System' && <span className="td-muted"> by {entry.by}</span>}
                          {entry.to && <span className="td-muted"> → {entry.to}</span>}
                        </span>
                        <span className="gm-activity-meta">
                          Room {entry.room} · {entry.task_type} · {elapsed(entry.time)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {showCreate && (
        <GMCreateTaskModal
          rooms={rooms}
          departments={departments}
          managers={managers}
          gmUser={user}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      </div>
    </div>
  );
}
