'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, CheckCircle2, Clock, ClipboardList,
  Flame, BarChart2, Activity, LogOut, RefreshCw, Plus, X, ArrowRight,
  ClipboardCheck, Wrench, ShieldAlert, ArrowRightCircle, Star
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';

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

/* ── KPI Stat Card ───────────────────────────────────────── */
function StatCard({ label, value, color, colorClass, icon, onClick, context, contextClass }) {
  return (
    <div
      className={`gm-stat-card ${colorClass || ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="gm-stat-kpi-top">
        <div className={`gm-stat-value ${colorClass ? colorClass.replace('gm-stat-card-', 'gm-stat-value-') : ''}`}>{value}</div>
        <div className="gm-stat-icon">{icon}</div>
      </div>
      <div className="gm-stat-bottom">
        <div className="gm-stat-label">{label}</div>
        {context && <div className={`gm-stat-context ${contextClass || 'gm-stat-context-muted'}`}>{context}</div>}
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
  const showToast = useToast();

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

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
      showToast({ type: 'success', message: 'Task created and assigned successfully' });
      onClose();
    } catch (err) {
      setError(err.message);
      showToast({ type: 'error', message: err.message });
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

/* ── Detail Modal ────────────────────────────────────────── */
function DetailModal({ title, tasks, onClose }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '600px', width: '95%' }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px' }}>
          {tasks.length === 0 ? (
            <p className="td-muted">No items found.</p>
          ) : (
            <div className="gm-list">
              {tasks.map(t => (
                <div key={t.id} className="gm-list-item">
                  <div className="gm-item-header">
                    <strong>Room {t.rooms?.room_number}</strong>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <LevelBadge level={t.current_level} />
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                  <div className="gm-item-body">
                    {t.departments?.name} — {t.task_type}
                    {t.assigned_staff?.name && <span className="td-muted"> (Assigned to {t.assigned_staff.name})</span>}
                  </div>
                  <div className="gm-item-footer">
                    {isDelayed(t) && <span className="sla-delayed">⚠ Delayed {delayMins(t)}m</span>}
                    <span className="td-muted">{elapsed(t.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
  const [detailView, setDetailView]   = useState(null); // { title: string, tasks: array }
  const showToast = useToast();

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
      const responses = await Promise.all([
        fetch('/api/tasks?role=gm', { headers }),
        fetch('/api/departments', { headers }),
        fetch('/api/rooms', { headers }),
        fetch('/api/staff', { headers }),
      ]);
      
      for (const res of responses) {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP error ${res.status}`);
        }
      }

      const [t, d, r, s] = await Promise.all(responses.map(res => res.json()));
      setTasks(Array.isArray(t) ? t : []);
      setDepartments(Array.isArray(d) ? d : []);
      setRooms(Array.isArray(r) ? r : []);
      setAllStaff(Array.isArray(s) ? s.filter(x => x.is_active) : []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
      showToast({ type: 'error', message: 'Failed to load data: ' + err.message });
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
    if (window.confirm('Are you sure you want to log out?')) {
      localStorage.removeItem('currentUser');
      router.push('/login');
    }
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
  const completedInTime = tasks.filter(t => t.status === 'completed' && !isDelayed(t));
  
  // Calculate Guest Service Score
  const staffScores = allStaff.map(staff => {
    const staffTasks = tasks.filter(t => t.assigned_staff?.id === staff.id);
    const inTime = staffTasks.filter(t => t.status === 'completed' && !isDelayed(t)).length;
    const isLate = staffTasks.filter(t => t.status === 'completed' && isDelayed(t)).length;
    const escs = staffTasks.filter(t => t.escalation_level >= 1).length;
    const failed = staffTasks.filter(t => t.status === 'failed' || t.status === 'cancelled').length;
    
    // Scoring logic
    const score = (inTime * 10) + (isLate * 5) - (escs * 10) - (failed * 5);
    return { ...staff, score, inTime, isLate, escs };
  }).sort((a, b) => b.score - a.score);

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

  const ActivityIconCmp = ({ event }) => {
    const s = 14;
    switch (event) {
      case 'created': return <ClipboardList size={s} color="#3B82F6" />;
      case 'acknowledged': return <CheckCircle2 size={s} color="#10B981" />;
      case 'started': return <Wrench size={s} color="#F59E0B" />;
      case 'completed': return <ClipboardCheck size={s} color="#059669" />;
      case 'reassigned': return <RefreshCw size={s} color="#8B5CF6" />;
      case 'escalated': return <ShieldAlert size={s} color="#DC2626" />;
      case 'assigned': return <ArrowRightCircle size={s} color="#6366F1" />;
      default: return <Activity size={s} color="#6B7280" />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        {error && <div className="error-banner" style={{ margin: 20 }}>{error}</div>}
        {/* Role bar */}
        <div className="role-bar">
          <span style={{ fontWeight: 600 }}>{user.name}</span>
          <div className="role-spacer" />
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            <LogOut size={13} /> Logout
          </button>
        </div>

        <header className="page-header">
          <div>
            <div className="page-header-title">Executive Dashboard</div>
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
          </div>
        </header>

        <main className="page-body">
          {/* ── Summary Stats ───────────────────────────── */}
        <div className="gm-stats-grid">
          <StatCard
            label="Total Requests"
            value={todayTasks.length}
            colorClass="gm-stat-card-total"
            icon={<ClipboardList size={20} />}
            context={todayTasks.length === 0 ? 'No requests today' : `${todayTasks.length} task${todayTasks.length !== 1 ? 's' : ''} logged today`}
            contextClass="gm-stat-context-muted"
            onClick={() => setDetailView({ title: 'Total Requests (Today)', tasks: todayTasks })}
          />
          <StatCard
            label="Completed in Time"
            value={completedInTime.length}
            colorClass="gm-stat-card-good"
            icon={<CheckCircle2 size={20} />}
            context={completedInTime.length > 0 ? `${completedInTime.length} resolved on time ✓` : 'None completed yet'}
            contextClass={completedInTime.length > 0 ? 'gm-stat-context-ok' : 'gm-stat-context-muted'}
            onClick={() => setDetailView({ title: 'Completed in Time', tasks: completedInTime })}
          />
          <StatCard
            label="Delays"
            value={delayed.length}
            colorClass={delayed.length > 0 ? 'gm-stat-card-delay' : 'gm-stat-card-good'}
            icon={<AlertTriangle size={20} />}
            context={delayed.length === 0 ? 'All tasks on schedule ✓' : `⚠️ ${delayed.length} task${delayed.length !== 1 ? 's' : ''} past SLA`}
            contextClass={delayed.length === 0 ? 'gm-stat-context-ok' : 'gm-stat-context-warn'}
            onClick={() => setDetailView({ title: 'Delayed Tasks', tasks: delayed })}
          />
          <StatCard
            label="Complaints"
            value={complaints.length}
            colorClass={complaints.length > 0 ? 'gm-stat-card-danger' : 'gm-stat-card-good'}
            icon={<Flame size={20} />}
            context={complaints.length === 0 ? 'No active complaints' : `🔴 Requires immediate attention`}
            contextClass={complaints.length === 0 ? 'gm-stat-context-ok' : 'gm-stat-context-danger'}
            onClick={() => setDetailView({ title: 'Complaints', tasks: complaints })}
          />
          <StatCard
            label="Escalated"
            value={escalated.length}
            colorClass={escalated.length > 0 ? 'gm-stat-card-danger' : 'gm-stat-card-good'}
            icon={<AlertTriangle size={20} />}
            context={escalated.length === 0 ? 'No escalations' : `Escalated — action needed`}
            contextClass={escalated.length === 0 ? 'gm-stat-context-ok' : 'gm-stat-context-danger'}
            onClick={() => setDetailView({ title: 'Escalated Tasks', tasks: escalated })}
          />
        </div>

        {/* ── Pipeline Chain Bar ────────────────────── */}
        <div className="gm-chain-bar">
          <div className="gm-chain-segment">
            <div className="gm-chain-count gm-chain-count-manager">{atManager}</div>
            <div className="gm-chain-label">At Manager</div>
          </div>
          <div className="gm-chain-segment">
            <div className="gm-chain-count gm-chain-count-supervisor">{atSupervisor}</div>
            <div className="gm-chain-label">At Supervisor</div>
          </div>
          <div className="gm-chain-segment">
            <div className="gm-chain-count gm-chain-count-staff">{atStaff}</div>
            <div className="gm-chain-label">At Staff</div>
          </div>
        </div>


        <div className="gm-content-grid">
          {/* ── Left Column ─────────────────────────── */}
          <div className="gm-left">

            {/* Active Complaints */}
            <div className="gm-section">
              <div className="gm-section-title">
                <Flame size={14} color="#DC2626" />
                Active Complaints
                <span className="gm-section-count">{complaints.length}</span>
              </div>
              <div className="gm-list">
                {complaints.length === 0 ? (
                  <div className="gm-empty-state">
                    <div className="gm-empty-icon"><CheckCircle2 size={36} /></div>
                    <div className="gm-empty-title">Operations clear</div>
                    <div className="gm-empty-sub">No active complaints at this time</div>
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
                        {t.notes && <span className="td-muted"> &middot; {t.notes}</span>}
                      </div>
                      <div className="gm-item-footer">
                        {isDelayed(t) && <span className="sla-delayed">⚠ Delayed {delayMins(t)}m</span>}
                        {t.escalation_level >= 1 && <span className="badge badge-critical">Escalated</span>}
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
                <AlertTriangle size={14} color="#D97706" />
                Delayed Tasks
                <span className="gm-section-count">{delayed.length}</span>
              </div>
              <div className="gm-list">
                {delayed.length === 0 ? (
                  <div className="gm-empty-state">
                    <div className="gm-empty-icon"><CheckCircle2 size={36} /></div>
                    <div className="gm-empty-title">All tasks on schedule</div>
                    <div className="gm-empty-sub">No SLA breaches detected</div>
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
                <BarChart2 size={14} /> Department Performance
              </div>
              {deptStats.length === 0 ? (
                <div className="gm-empty-state">
                  <div className="gm-empty-icon"><BarChart2 size={36} /></div>
                  <div className="gm-empty-title">No activity today</div>
                  <div className="gm-empty-sub">Performance data will appear as tasks are logged</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {deptStats.map(d => {
                    const pctDone = d.total === 0 ? 0 : Math.round((d.completed / d.total) * 100);
                    const barClass = pctDone >= 75 ? 'gm-perf-bar-good' : pctDone >= 40 ? 'gm-perf-bar-warn' : 'gm-perf-bar-low';
                    return (
                      <div key={d.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        onClick={() => setDetailView({ title: `Logs: ${d.name}`, tasks: tasks.filter(t => t.departments?.id === d.id && isToday(t.created_at)) })}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: '0.845rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.name}</span>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{d.completed}/{d.total} done</span>
                            {d.delayed > 0 && <span style={{ color: '#DC2626', fontWeight: 700, fontSize: '0.75rem' }}>{d.delayed} delayed</span>}
                            <span style={{ fontWeight: 700, color: pctDone >= 75 ? '#059669' : pctDone >= 40 ? '#D97706' : 'var(--text-muted)', fontSize: '0.82rem' }}>{pctDone}%</span>
                          </div>
                        </div>
                        <div className="gm-perf-bar-wrap">
                          <div className={`gm-perf-bar-fill ${barClass}`} style={{ width: `${pctDone}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Guest Service Score — Leaderboard */}
            <div className="gm-section" style={{ marginTop: 0 }}>
              <div className="gm-section-title">
                <Star size={14} color="#D97706" /> Guest Service Score
                <span className="gm-section-count">{staffScores.filter(s => s.inTime + s.isLate + s.escs > 0).length} staff</span>
              </div>
              {staffScores.filter(s => s.inTime + s.isLate + s.escs > 0).length === 0 ? (
                <div className="gm-empty-state">
                  <div className="gm-empty-icon"><Star size={36} /></div>
                  <div className="gm-empty-title">No scores yet</div>
                  <div className="gm-empty-sub">Scores populate as tasks are completed</div>
                </div>
              ) : (
                <div className="gm-leaderboard">
                  {staffScores.filter(s => s.inTime + s.isLate + s.escs > 0).slice(0, 10).map((staff, idx) => (
                    <div key={staff.id} className={`gm-leaderboard-row ${idx === 0 ? 'top-performer' : ''}`}>
                      <div className={`gm-leaderboard-rank ${idx === 0 ? 'rank-1' : ''}`}>
                        {idx + 1}
                      </div>
                      <div className="gm-leaderboard-info">
                        <div className="gm-leaderboard-name">{staff.name}</div>
                        <div className="gm-leaderboard-sub">
                          <span className="gm-leaderboard-stat" style={{ color: '#059669' }}>✓ {staff.inTime}</span>
                          <span style={{ color: 'var(--border)' }}>|</span>
                          <span className="gm-leaderboard-stat" style={{ color: '#D97706' }}>~ {staff.isLate}</span>
                          <span style={{ color: 'var(--border)' }}>|</span>
                          <span className="gm-leaderboard-stat" style={{ color: '#DC2626' }}>↑ {staff.escs}</span>
                        </div>
                      </div>
                      <div className={`gm-leaderboard-score ${staff.score > 0 ? 'gm-score-pos' : staff.score < 0 ? 'gm-score-neg' : 'gm-score-zero'}`}>
                        {staff.score > 0 ? `+${staff.score}` : staff.score}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity — Timeline */}
            <div className="gm-section">
              <div className="gm-section-title">
                <Activity size={14} /> Live Activity Feed
              </div>
              {recentSlice.length === 0 ? (
                <div className="gm-empty-state">
                  <div className="gm-empty-icon"><Activity size={36} /></div>
                  <div className="gm-empty-title">No recent activity</div>
                  <div className="gm-empty-sub">Events will appear here as tasks are actioned</div>
                </div>
              ) : (
                <div className="gm-activity-feed">
                  {recentSlice.map((entry, i) => (
                    <div key={i} className="gm-activity-item">
                      <div className="gm-activity-icon">
                        <ActivityIconCmp event={entry.event} />
                      </div>
                      <div className="gm-activity-body">
                        <span className="gm-activity-event">
                          <strong>{entry.task_code}</strong> — {entry.event}
                          {entry.by && entry.by !== 'System' && <span className="td-muted"> by {entry.by}</span>}
                          {entry.to && <span className="td-muted"> → {entry.to}</span>}
                        </span>
                        <span className="gm-activity-meta">
                          Room {entry.room}
                          <span className="gm-activity-meta-dot" />
                          {entry.task_type}
                        </span>
                      </div>
                      <div className="gm-activity-time">{elapsed(entry.time)}</div>
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

      {detailView && (
        <DetailModal
          title={detailView.title}
          tasks={detailView.tasks}
          onClose={() => setDetailView(null)}
        />
      )}
      </div>
    </div>
  );
}
