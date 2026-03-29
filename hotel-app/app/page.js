'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, CheckCircle2, Clock, ClipboardList, AlertTriangle,
  X, MessageSquare, Users, Zap, PlayCircle, UserCheck,
  ChevronDown, ChevronUp, LogOut, History, Search, ArrowRight,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';

/* ════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function elapsed(iso) {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function durationMins(start, end) {
  return Math.round((new Date(end) - new Date(start)) / 60_000);
}

function elapsedMins(iso) {
  return (Date.now() - new Date(iso).getTime()) / 60_000;
}

function isDelayed(task) {
  if (task.status === 'completed') return false;
  return elapsedMins(task.created_at) > (task.expected_time ?? 10);
}

function delayMins(task) {
  return Math.max(0, Math.round(elapsedMins(task.created_at) - (task.expected_time ?? 10)));
}

// Dept → default task types
const DEPT_TASK_TYPES = {
  'Housekeeping': ['Room Cleaning', 'Towels', 'Extra Pillows', 'Extra Blanket', 'Bed Making', 'Trash Removal', 'Turndown Service'],
  'Laundry':      ['Laundry Pickup', 'Dry Cleaning', 'Express Laundry', 'Ironing', 'Laundry Return', 'Stain Treatment'],
  'Bell Desk':    ['Luggage Assistance', 'Wake-up Call', 'Taxi Booking', 'Parcel Delivery', 'Guest Arrival', 'Guest Departure'],
  'Maintenance':  ['AC Not Working', 'Light Bulb Fix', 'Plumbing Issue', 'TV / Remote Issue', 'Door Lock Issue', 'Water Leakage', 'Safe Not Opening'],
};
const FALLBACK_TASK_TYPES = ['Room Service', 'Water Bottles', 'Minibar Refill', 'Other'];

/* ════════════════════════════════════════════════════════════
   SMALL BADGE COMPONENTS
═══════════════════════════════════════════════════════════════ */
function StatusBadge({ status }) {
  const map = {
    pending:      { label: 'Pending',      cls: 'badge-pending' },
    acknowledged: { label: 'Acknowledged', cls: 'badge-acknowledged' },
    in_progress:  { label: 'In Progress',  cls: 'badge-in_progress' },
    completed:    { label: 'Completed',    cls: 'badge-completed' },
  };
  const b = map[status] ?? { label: status, cls: '' };
  return <span className={`badge ${b.cls}`}><span className="badge-dot" />{b.label}</span>;
}

function TypeBadge({ type }) {
  if (type === 'complaint') return <span className="badge badge-complaint"><span className="badge-dot" /> Complaint</span>;
  return <span className="badge badge-normal">Request</span>;
}

function EscalationBadge({ level }) {
  if (!level || level === 0) return null;
  if (level === 1) return <span className="badge badge-escalated"><span className="badge-dot" /> Escalated</span>;
  return <span className="badge badge-critical"><span className="badge-dot" /> Critical</span>;
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

function SmsBadge({ status }) {
  if (!status || status === 'no_staff') return null;
  const map = {
    sending: { label: '🟡 Sending…', cls: 'sms-badge sms-sending' },
    sent:    { label: '🟢 SMS Sent', cls: 'sms-badge sms-sent' },
    failed:  { label: '🔴 SMS Failed', cls: 'sms-badge sms-failed' },
  };
  const b = map[status];
  if (!b) return null;
  return <span className={b.cls}>{b.label}</span>;
}

function SlaIndicator({ task, tick }) {
  if (task.status === 'completed' && task.completed_at) {
    const mins = durationMins(task.created_at, task.completed_at);
    const over = mins > (task.expected_time ?? 10);
    return <span className={over ? 'sla-delayed' : 'sla-ontime'}>{over ? `${mins}m (over SLA) ` : `${mins}m `}</span>;
  }
  const mins = Math.round(elapsedMins(task.created_at));
  const sla  = task.expected_time ?? 10;
  if (mins <= sla) return <span className="timer-cell"><Clock size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />{mins < 1 ? '<1m' : `${mins}m`}</span>;
  return <span className="sla-delayed">+{mins - sla}m over</span>;
}

/* ── Activity Log ────────────────────────────────────────── */
function ActivityLog({ log }) {
  if (!Array.isArray(log) || log.length === 0) {
    return <div className="activity-empty">No history yet.</div>;
  }
  const icons = { created: '📋', acknowledged: '✅', started: '🔧', completed: '✓', reassigned: '↩', escalated: '🔴', assigned: '→' };
  return (
    <div className="activity-log">
      {[...log].reverse().map((entry, i) => (
        <div key={i} className="activity-entry">
          <span className="activity-icon">{icons[entry.event] ?? '•'}</span>
          <div className="activity-content">
            <span className="activity-event">{entry.event}</span>
            {entry.by && <span className="activity-by"> by {entry.by}</span>}
            {entry.from && <span className="activity-by"> ({entry.from} → {entry.to})</span>}
            {entry.level && !entry.from && <span className="activity-by"> → {entry.to} ({entry.level})</span>}
          </div>
          <span className="activity-time">{elapsed(entry.time)}</span>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TEST SMS MODAL
═══════════════════════════════════════════════════════════════ */
function TestSmsModal({ onClose, onDone }) {
  const [command, setCommand] = useState('DONE');
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);

  const handleTest = async (e) => {
    e.preventDefault();
    setLoading(true); setResult(null);
    const taskCode = code.trim().toUpperCase().startsWith('T') ? code.trim() : `T${code.trim()}`;
    const message  = command === 'DONE' ? taskCode : `${command} ${taskCode}`;
    try {
      const res  = await fetch('/api/sms-reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
      const data = await res.json();
      setResult({ ok: data.success, data, sentMsg: message });
    } catch (err) {
      setResult({ ok: false, data: { reason: err.message }, sentMsg: '' });
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <span className="modal-title">📱 Test SMS Reply</span>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleTest}>
          <div className="modal-body">
            <div className="sms-commands">
              <div><code>OK T123</code> → Acknowledged</div>
              <div><code>START T123</code> → In Progress</div>
              <div><code>DONE T123</code> → Completed</div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Command</label>
                <select value={command} onChange={e => setCommand(e.target.value)}>
                  <option value="OK">OK — Acknowledge</option>
                  <option value="START">START — Begin Work</option>
                  <option value="DONE">DONE — Complete</option>
                </select>
              </div>
              <div className="field">
                <label>Task Code</label>
                <input type="text" placeholder="e.g. T142" value={code} onChange={e => setCode(e.target.value)} required autoFocus />
              </div>
            </div>
            {result && (
              <div className={result.ok ? 'success-banner' : 'error-banner'} style={{ marginTop: 0 }}>
                {result.ok ? `✅ "${result.sentMsg}" → ${result.data.new_status ?? 'updated'}` : `❌ ${result.data.reason || result.data.note || 'Failed'}`}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !code.trim()}>{loading ? 'Simulating…' : 'Simulate'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CREATE TASK MODAL
═══════════════════════════════════════════════════════════════ */
function CreateTaskModal({ rooms, departments, allStaff, onClose, onCreated, currentUser }) {
  const isReceptionOrGM = ['gm', 'reception'].includes(currentUser?.role);
  const [form, setForm] = useState({ 
    room_id: '', 
    department_id: isReceptionOrGM ? '' : (currentUser?.department_id || ''), 
    task_type: '', 
    task_type_custom: '', 
    priority: 'normal', 
    type: 'request', 
    notes: '', 
    initial_manager_id: '' 
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Managers available for GM to assign to (filtered by dept once dept selected)
  const managersInDept = allStaff.filter(s => s.role === 'manager' &&
    (!form.department_id || String(s.department_id) === String(form.department_id)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const taskType = form.task_type === '__custom__' ? form.task_type_custom : form.task_type;
    if (!form.room_id || !form.department_id || !taskType) { setError('Room, Department and Task Type are required.'); return; }
    if (currentUser?.role === 'gm' && !form.initial_manager_id) { setError('Please select a manager to assign this task to.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id:            parseInt(form.room_id),
          department_id:      parseInt(form.department_id),
          task_type:          taskType,
          priority:           form.priority,
          type:               form.type,
          notes:              form.notes || undefined,
          created_by:         currentUser?.name ?? 'Reception',
          creator_role:       currentUser?.role ?? 'staff',
          initial_manager_id: form.initial_manager_id ? parseInt(form.initial_manager_id) : null,
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

  const deptName = departments.find(d => String(d.id) === String(form.department_id))?.name;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">New Service Request</span>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">{error}</div>}
            {/* Type */}
            {isReceptionOrGM && (
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
            )}
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
                {isReceptionOrGM ? (
                  <select value={form.department_id} onChange={e => { set('department_id', e.target.value); set('task_type', ''); }} required>
                    <option value="">Select dept…</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                ) : (
                  <div className="field-disabled" style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, color: '#64748b', fontSize: '0.85rem' }}>
                    {departments.find(d => String(d.id) === String(form.department_id))?.name || 'Your Department'}
                  </div>
                )}
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
                <input type="text" placeholder="e.g. Extra towels" value={form.task_type_custom} onChange={e => set('task_type_custom', e.target.value)} required />
              </div>
            )}
            {/* GM: assign to manager */}
            {currentUser?.role === 'gm' && (
              <div className="field">
                <label className="field-required">Assign to Manager</label>
                <select value={form.initial_manager_id}
                  onChange={e => set('initial_manager_id', e.target.value)} required>
                  <option value="">{form.department_id ? (managersInDept.length ? 'Select manager…' : 'No managers in this dept') : 'Select department first…'}</option>
                  {managersInDept.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
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
              <textarea placeholder="Additional details for staff…" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create Task'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   WORKLOAD PANEL
═══════════════════════════════════════════════════════════════ */
function WorkloadPanel({ currentUser }) {
  const [workload, setWorkload] = useState([]);
  const [loading, setLoading]  = useState(true);
  const canSee = ['gm', 'manager', 'supervisor'].includes(currentUser?.role);

  const load = useCallback(async () => {
    let url = '/api/workload';
    if ((currentUser?.role === 'supervisor' || currentUser?.role === 'manager') && currentUser?.department_id) {
      url += `?department_id=${currentUser.department_id}`;
    }
    const res = await fetch(url);
    if (res.ok) setWorkload(await res.json());
    setLoading(false);
  }, [currentUser?.role, currentUser?.department_id]);

  useEffect(() => { if (canSee) load(); }, [canSee, load]);
  if (!canSee) return null;

  return (
    <div className="workload-panel">
      <div className="workload-header"><Users size={15} /> Staff Workload — Active Tasks</div>
      {loading ? (
        <div className="loading-wrap" style={{ padding: '16px 20px' }}><div className="spinner" /> Loading…</div>
      ) : workload.length === 0 ? (
        <div style={{ padding: '14px 20px', color: 'var(--muted)', fontSize: '0.85rem' }}>No active staff found.</div>
      ) : (
        <div className="workload-grid">
          {workload.map(s => (
            <div key={s.staff_id} className="workload-card">
              <div>
                <div className="workload-name">{s.staff_name}</div>
                <div className="workload-role">{s.role} · {s.department_name}</div>
              </div>
              <div className={`workload-count${s.active_tasks === 0 ? ' count-zero' : s.active_tasks >= 4 ? ' count-high' : ''}`}>{s.active_tasks}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MOBILE TASK CARD (V4)
═══════════════════════════════════════════════════════════════ */
function TaskCard({ task, currentUser, smsStatus, onAction, onAssign, actionLoading, assignTargets, expandedId, setExpandedId }) {
  const isLoading = (key) => actionLoading[task.id] === key;
  const busy     = !!actionLoading[task.id];
  const expanded = expandedId === task.id;
  const tick     = 0;

  // Determine if current user can take status actions on THIS task
  const isAssignedToMe = task.assigned_to && currentUser?.id && String(task.assigned_to) === String(currentUser.id);
  const canDoStatusActions = isAssignedToMe && task.current_level !== 'manager';

  // Can current user assign down the chain?
  const role = currentUser?.role;
  const canAssignDown = (role === 'manager' && ['manager', 'supervisor', 'staff'].includes(task.current_level)) ||
                        (role === 'supervisor' && ['supervisor', 'staff'].includes(task.current_level));

  const assignee = task.assigned_staff ?? task.staff;

  return (
    <div className={`task-card ${task.type === 'complaint' ? 'task-card-complaint' : ''} ${task.escalation_level >= 2 ? 'task-card-critical' : task.escalation_level === 1 ? 'task-card-escalated' : ''}`}>
      {/* Header */}
      <div className="task-card-header">
        <div className="task-card-room" style={{ fontWeight: 700, fontSize: '1.1rem' }}>Room {task.rooms?.room_number}</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {['gm', 'reception'].includes(currentUser?.role) && <TypeBadge type={task.type || 'request'} />}
          {task.priority === 'urgent' && <span className="badge badge-urgent"><AlertTriangle size={10} /> Urgent</span>}
          <LevelBadge level={task.current_level} />
        </div>
      </div>

      {/* Task info */}
      <div className="task-card-dept" style={{ fontWeight: 500, fontSize: '0.9rem', color: '#334155' }}>{task.departments?.name} — {task.task_type}</div>
      {task.notes && <div className="task-card-notes" style={{ fontWeight: 300, color: '#64748b' }}>{task.notes}</div>}

      {/* Status + SLA row */}
      <div className="task-card-status-row">
        <StatusBadge status={task.status} />
        <EscalationBadge level={task.escalation_level} />
        <SlaIndicator task={task} tick={tick} />
      </div>

      {/* Assignee */}
      <div className="task-card-staff">
        {assignee ? (
          <span>→ {assignee.name} ({task.assigned_role ?? task.current_level}) <SmsBadge status={smsStatus[task.id]} /></span>
        ) : (
          <span className="td-muted">Unassigned</span>
        )}
      </div>

      {smsStatus[task.id] === 'failed' && (
        <div className="sms-fail-alert">⚠ SMS failed to send — staff may not be notified</div>
      )}

      {/* Action buttons */}
      {task.status !== 'completed' && (
        <div className="task-card-actions">
          {/* Assign down the chain */}
          {canAssignDown && assignTargets.length > 0 && (
            <select className="reassign-select" value=""
              onChange={e => onAssign(task.id, parseInt(e.target.value), currentUser.role)}
              disabled={busy}>
              <option value="">
                {role === 'manager' ? '→ Assign to Supervisor…' : '→ Assign to Staff…'}
              </option>
              {assignTargets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {/* Status actions — only for the directly assigned person */}
          {canDoStatusActions && (
            <>
              {task.status === 'pending' && (
                <button className="btn btn-acknowledge" onClick={() => onAction(task.id, { status: 'acknowledged' }, 'acknowledge')} disabled={busy}>
                  <UserCheck size={14} /> {isLoading('acknowledge') ? '…' : 'Acknowledge'}
                </button>
              )}
              {task.status === 'acknowledged' && (
                <button className="btn btn-start" onClick={() => onAction(task.id, { status: 'in_progress' }, 'start')} disabled={busy}>
                  <PlayCircle size={14} /> {isLoading('start') ? '…' : 'Start Work'}
                </button>
              )}
              {task.status === 'in_progress' && (
                <button className="btn btn-success" onClick={() => onAction(task.id, { status: 'completed' }, 'complete')} disabled={busy}>
                  <CheckCircle2 size={14} /> {isLoading('complete') ? '…' : 'Complete'}
                </button>
              )}
            </>
          )}
          {task.escalation_level < 2 && isAssignedToMe && (
            <button className="btn btn-escalate" onClick={() => { if (window.confirm(`Escalate ${task.task_code}?`)) onAction(task.id, { force_escalate: true }, 'escalate'); }} disabled={busy}>
              <Zap size={13} /> {isLoading('escalate') ? '…' : 'Escalate'}
            </button>
          )}
        </div>
      )}

      {/* Activity log toggle */}
      <button className="activity-toggle" onClick={() => setExpandedId(expanded ? null : task.id)}>
        <History size={12} /> {expanded ? 'Hide History' : 'View History'}
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && <ActivityLog log={task.activity_log} />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN DASHBOARD PAGE
═══════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const router = useRouter();

  /* ── Auth ─────────────────────────────────────────────────── */
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady]     = useState(false);

  useEffect(() => {
    try {
      const u = localStorage.getItem('currentUser');
      if (!u) { router.replace('/login'); return; }
      const parsed = JSON.parse(u);
      if (parsed.role === 'gm') { router.replace('/gm'); return; }
      setCurrentUser(parsed);
    } catch { router.replace('/login'); }
    setAuthReady(true);
  }, [router]);

  /* ── Data state ───────────────────────────────────────────── */
  const [tasks, setTasks]             = useState([]);
  const [rooms, setRooms]             = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allStaff, setAllStaff]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [smsStatus, setSmsStatus]     = useState({});

  /* ── UI state ─────────────────────────────────────────────── */
  const [showCreate, setShowCreate]   = useState(false);
  const [showTestSms, setShowTestSms] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [tick, setTick]               = useState(0);
  const [actionLoading, setActionLoading] = useState({});
  const [flashAlerts, setFlashAlerts] = useState([]);

  /* ── Filters ──────────────────────────────────────────────── */
  const [filterRoom, setFilterRoom]     = useState('');
  const [filterDept, setFilterDept]     = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType]     = useState('all');

  const shownEscalations = useRef(new Set());

  /* ── Role-based task URL (V4) ───────────────────────────── */
  const buildTasksUrl = useCallback((user) => {
    if (!user) return '/api/tasks?role=gm';
    const p = new URLSearchParams();
    p.set('role', user.role);
    // V4: supervisor and staff both filtered by assigned_to = user.id
    if (user.role === 'staff') {
      p.set('user_id', user.id);
    } else if (user.role === 'supervisor' && user.department_id) {
      p.set('department_id', user.department_id);
    } else if (user.role === 'manager' && user.department_id) {
      p.set('department_id', user.department_id);
    }
    if (filterDept) p.set('department_id', filterDept);
    if (filterStatus && filterStatus !== 'all') p.set('status', filterStatus);
    if (filterType   && filterType   !== 'all') p.set('type', filterType);
    if (filterRoom) p.set('room', filterRoom);
    return `/api/tasks?${p.toString()}`;
  }, [filterDept, filterStatus, filterType, filterRoom]);

  const loadAll = useCallback(async (silent = false) => {
    if (!authReady || !currentUser) return;
    try {
      const [tr, rr, dr, sr] = await Promise.all([
        fetch(buildTasksUrl(currentUser)),
        fetch('/api/rooms'),
        fetch('/api/departments'),
        fetch('/api/staff'),
      ]);
      const [t, r, d, s] = await Promise.all([tr.json(), rr.json(), dr.json(), sr.json()]);
      if (!tr.ok) throw new Error(t.error || 'Failed to load tasks');
      setTasks(Array.isArray(t) ? t : []);
      setRooms(Array.isArray(r) ? r : []);
      setDepartments(Array.isArray(d) ? d : []);
      setAllStaff(Array.isArray(s) ? s.filter(x => x.is_active) : []);
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [authReady, currentUser, buildTasksUrl]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Live SLA timer — re-render every 30s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Auto-refresh + escalation flash every 20s
  useEffect(() => {
    const id = setInterval(async () => {
      loadAll(true);
      try {
        const res = await fetch('/api/escalation');
        if (!res.ok) return;
        const { escalated } = await res.json();
        if (!Array.isArray(escalated) || escalated.length === 0) return;
        const newAlerts = [];
        for (const item of escalated) {
          const key = `${item.task_id}-${item.level}`;
          if (shownEscalations.current.has(key)) continue;
          shownEscalations.current.add(key);
          newAlerts.push({ key, level: item.level, message: item.level === 1 ? `Task ${item.task_code} escalated to supervisor` : `Task ${item.task_code} — CRITICAL, escalated to manager` });
        }
        if (newAlerts.length) {
          setFlashAlerts(prev => [...prev, ...newAlerts]);
          setTimeout(() => setFlashAlerts(prev => prev.filter(a => !newAlerts.some(n => n.key === a.key))), 5000);
        }
      } catch {}
    }, 20_000);
    return () => clearInterval(id);
  }, [loadAll]);

  /* ── Actions ──────────────────────────────────────────────── */
  const taskAction = async (taskId, payload, actionKey) => {
    setActionLoading(prev => ({ ...prev, [taskId]: actionKey }));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, by: currentUser?.name ?? 'Unknown' }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error);
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [taskId]: null }));
    }
  };

  // V4: Chain assign action
  const taskAssign = async (taskId, targetStaffId, assignerRole) => {
    setActionLoading(prev => ({ ...prev, [taskId]: 'assign' }));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assign_to:     targetStaffId,
          assigner_role: assignerRole,
          by:            currentUser?.name ?? 'Unknown',
        }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error);
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [taskId]: null }));
    }
  };

  const handleCreated = (task) => {
    setTasks(prev => { const e = prev.some(t => t.id === task.id); return e ? prev.map(t => t.id === task.id ? task : t) : [task, ...prev]; });
    if (task.sms_status) setSmsStatus(prev => ({ ...prev, [task.id]: task.sms_status }));
  };

  const logout = () => { localStorage.removeItem('currentUser'); router.push('/login'); };

  /* ── Derived data (V4) ───────────────────────────────────── */
  // Supervisors in current user's dept (for manager to assign)
  const supervisorsInMyDept = allStaff.filter(s =>
    s.role === 'supervisor' && String(s.department_id) === String(currentUser?.department_id)
  );
  // Staff in current user's dept (for supervisor to assign)
  const staffInMyDept = allStaff.filter(s =>
    s.role === 'staff' && String(s.department_id) === String(currentUser?.department_id)
  );
  // Assign targets based on current user role
  const assignTargets = currentUser?.role === 'manager' ? supervisorsInMyDept
                      : currentUser?.role === 'supervisor' ? staffInMyDept
                      : [];

  // Legacy staffByDept for workload panel
  const staffByDept = {};
  for (const s of allStaff) {
    const dId = s.departments?.id ?? s.department_id;
    if (!dId) continue;
    if (!staffByDept[dId]) staffByDept[dId] = [];
    staffByDept[dId].push(s);
  }

  // Stats
  const pendingCount    = tasks.filter(t => t.status === 'pending').length;
  const ackCount        = tasks.filter(t => t.status === 'acknowledged').length;
  const inProgCount     = tasks.filter(t => t.status === 'in_progress').length;
  const escalatedCount  = tasks.filter(t => t.status !== 'completed' && t.escalation_level >= 1).length;
  const complaintCount  = tasks.filter(t => t.type === 'complaint' && t.status !== 'completed').length;
  const delayedCount    = tasks.filter(isDelayed).length;
  const unassignedCount = tasks.filter(t => t.unassigned && t.status !== 'completed').length;

  const smsFailed = tasks.filter(t => smsStatus[t.id] === 'failed');

  if (!authReady) return null;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">

        {/* ── Flash Alerts ─────────────────────────────── */}
        {flashAlerts.length > 0 && (
          <div className="flash-alerts">
            {flashAlerts.map(a => (
              <div key={a.key} className={`flash-alert flash-alert-l${a.level}`}>
                {a.level === 1 ? '⚠️' : '🔴'} {a.message}
              </div>
            ))}
          </div>
        )}

        {/* ── SMS Failure Banner ───────────────────────── */}
        {smsFailed.length > 0 && (
          <div className="sms-fail-banner">
            📵 SMS failed for {smsFailed.length} task{smsFailed.length > 1 ? 's' : ''}: {smsFailed.map(t => t.task_code).join(', ')} — Staff may not be notified!
          </div>
        )}

        {/* ── Role / User Header Bar ───────────────────── */}
        <div className="role-bar">
          <span className={`role-bar-pill role-${currentUser?.role}`}>{currentUser?.role?.toUpperCase()}</span>
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{currentUser?.name}</span>
          {currentUser?.department_id && <span className="td-muted td-dept-label">{departments.find(d => d.id === currentUser.department_id)?.name}</span>}
          <div className="role-spacer"></div>
          <button className="btn btn-ghost btn-sm" onClick={logout} style={{ color: '#94a3b8' }}>
            <LogOut size={13} /> Logout
          </button>
        </div>

        <header className="page-header">
          <div>
            <div className="page-header-title">{currentUser?.role === 'reception' ? 'Reception Dashboard' : (currentUser?.role === 'manager' ? 'Manager Dashboard' : (currentUser?.role === 'supervisor' ? 'Supervisor Dashboard' : 'Staff Dashboard'))}</div>
            <div className="page-header-sub">Guest Service Requests</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost" onClick={() => setShowTestSms(true)}><MessageSquare size={15} /> Test SMS</button>
            {currentUser?.role !== 'staff' && (
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New Request</button>
            )}
          </div>
        </header>

        <main className="page-body">
          {error && <div className="error-banner">{error}</div>}

          {/* ── Sticky Mobile Stats Bar ──────────────── */}
          <div className="sticky-stats-bar">
            <span>⏳ Pending: <strong>{pendingCount}</strong></span>
            {complaintCount > 0 && <span>⚠ Complaints: <strong style={{ color: '#dc2626' }}>{complaintCount}</strong></span>}
            {escalatedCount > 0 && <span>🔴 Escalated: <strong style={{ color: '#dc2626' }}>{escalatedCount}</strong></span>}
            {delayedCount > 0   && <span>🕐 Delayed: <strong style={{ color: '#ea580c' }}>{delayedCount}</strong></span>}
          </div>

          {/* ── Stats Row ────────────────────────────── */}
          <div className="stats-row">
            <div className="stat-card"><div className="stat-label">⏳ Pending</div><div className="stat-value pending">{pendingCount}</div></div>
            <div className="stat-card"><div className="stat-label">✅ Acknowledged</div><div className="stat-value" style={{ color: '#1e40af' }}>{ackCount}</div></div>
            <div className="stat-card"><div className="stat-label">🔧 In Progress</div><div className="stat-value" style={{ color: '#c2410c' }}>{inProgCount}</div></div>
            <div className="stat-card"><div className="stat-label">🔴 Delayed</div><div className="stat-value" style={{ color: '#dc2626' }}>{delayedCount}</div></div>
            {['gm', 'reception'].includes(currentUser?.role) && complaintCount > 0 && <div className="stat-card"><div className="stat-label">⚠ Complaints</div><div className="stat-value" style={{ color: '#dc2626' }}>{complaintCount}</div></div>}
            {escalatedCount > 0 && <div className="stat-card"><div className="stat-label">🟠 Escalated</div><div className="stat-value" style={{ color: '#ea580c' }}>{escalatedCount}</div></div>}
            {unassignedCount > 0 && <div className="stat-card"><div className="stat-label">⚠ Unassigned</div><div className="stat-value" style={{ color: '#92400e' }}>{unassignedCount}</div></div>}
          </div>

          {/* ── Filter Bar ───────────────────────────── */}
          <div className="filter-bar">
            <div className="filter-field">
              <Search size={13} className="filter-icon" />
              <input type="text" placeholder="Room #" value={filterRoom} onChange={e => setFilterRoom(e.target.value)} className="filter-input" />
            </div>
            {['gm', 'reception'].includes(currentUser?.role) && (
              <select className="filter-select" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                <option value="">All Depts</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            {['gm', 'reception'].includes(currentUser?.role) && (
              <select className="filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="all">All Types</option>
                <option value="request">Requests</option>
                <option value="complaint">Complaints</option>
              </select>
            )}
            {(filterRoom || filterDept || filterStatus !== 'all' || filterType !== 'all') && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setFilterRoom(''); setFilterDept(''); setFilterStatus('all'); setFilterType('all'); }}>
                <X size={12} /> Clear
              </button>
            )}
          </div>

          {/* ══════════════════════════════════════════════
              DESKTOP: TABLE VIEW
          ══════════════════════════════════════════════ */}
          <div className="card desktop-only">
            <div className="card-header">
              <span className="card-title"><ClipboardList size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Service Requests</span>
            </div>
            {loading ? (
              <div className="loading-wrap"><div className="spinner" /> Loading tasks…</div>
            ) : tasks.length === 0 ? (
              <div className="empty-state"><ClipboardList size={40} /><p>No active tasks right now.</p><p style={{ marginTop: 6, fontWeight: 400, fontSize: '0.85rem' }}>All requests are fulfilled.</p></div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>{['gm', 'reception'].includes(currentUser?.role) && <th>Type</th>}<th>Room</th><th>Task</th><th>Dept</th>
                      <th>Level</th><th>Assigned To</th><th>Status</th><th>SLA</th>
                      <th>Escalation</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(task => {
                      const rowCls = [
                        task.escalation_level === 2 ? 'row-critical' : task.escalation_level === 1 ? 'row-escalated' : '',
                        task.type === 'complaint' ? 'row-complaint' : '',
                      ].filter(Boolean).join(' ');
                      const isLoading = (key) => actionLoading[task.id] === key;
                      const busy      = !!actionLoading[task.id];
                      const assignee  = task.assigned_staff ?? task.staff;
                      // V4 role-gate checks
                      const isAssignedToMe = task.assigned_to && currentUser?.id && String(task.assigned_to) === String(currentUser.id);
                      const canDoStatus = isAssignedToMe && task.current_level !== 'manager';
                      const canAssignDown = (currentUser?.role === 'manager' && ['manager', 'supervisor', 'staff'].includes(task.current_level)) ||
                                           (currentUser?.role === 'supervisor' && ['supervisor', 'staff'].includes(task.current_level));
                      return (
                        <tr key={task.id} className={rowCls}>
                          <td><span className="task-code">{task.task_code}</span></td>
                          {['gm', 'reception'].includes(currentUser?.role) && <td><TypeBadge type={task.type || 'request'} /></td>}
                          <td>
                            <strong>Room {task.rooms?.room_number}</strong>
                            <div className="td-muted" style={{ fontSize: '0.73rem', fontWeight: 300 }}>Floor {task.rooms?.floor}</div>
                          </td>
                          <td style={{ fontWeight: 500 }}>{task.task_type}</td>
                          <td className="td-muted" style={{ fontWeight: 500 }}>{task.departments?.name}</td>
                          <td><LevelBadge level={task.current_level} /></td>
                          <td>
                            {assignee ? (
                              <>
                                <div style={{ fontWeight: 500 }}>{assignee.name}</div>
                                {task.current_level === 'staff' && <SmsBadge status={smsStatus[task.id]} />}
                                {canAssignDown && task.status !== 'completed' && assignTargets.length > 0 && (
                                  <select className="reassign-select" value=""
                                    onChange={e => taskAssign(task.id, parseInt(e.target.value), currentUser.role)}
                                    disabled={busy}>
                                    <option value="">
                                      {currentUser?.role === 'manager' ? '→ Assign Supervisor…' : '→ Assign Staff…'}
                                    </option>
                                    {assignTargets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                  </select>
                                )}
                              </>
                            ) : (
                              <span className="td-muted">Unassigned</span>
                            )}
                          </td>
                          <td><StatusBadge status={task.status} /></td>
                          <td><SlaIndicator task={task} tick={tick} /></td>
                          <td><EscalationBadge level={task.escalation_level} /></td>
                          <td>
                            <div className="action-cell">
                              {canDoStatus && task.status === 'pending' && <button className="btn btn-acknowledge btn-sm" onClick={() => taskAction(task.id, { status: 'acknowledged' }, 'acknowledge')} disabled={busy}><UserCheck size={11} /> {isLoading('acknowledge') ? '…' : 'Ack'}</button>}
                              {canDoStatus && task.status === 'acknowledged' && <button className="btn btn-start btn-sm" onClick={() => taskAction(task.id, { status: 'in_progress' }, 'start')} disabled={busy}><PlayCircle size={11} /> {isLoading('start') ? '…' : 'Start'}</button>}
                              {canDoStatus && task.status === 'in_progress' && <button className="btn btn-success btn-sm" onClick={() => taskAction(task.id, { status: 'completed' }, 'complete')} disabled={busy}><CheckCircle2 size={11} /> {isLoading('complete') ? '…' : 'Done'}</button>}
                              {isAssignedToMe && task.status !== 'completed' && task.escalation_level < 2 && (
                                <button className="btn btn-escalate btn-sm" onClick={() => { if (window.confirm(`Escalate ${task.task_code}?`)) taskAction(task.id, { force_escalate: true }, 'escalate'); }} disabled={busy}>
                                  <Zap size={11} /> {isLoading('escalate') ? '…' : 'Escalate'}
                                </button>
                              )}
                              {task.status === 'completed' && <span className="td-muted" style={{ fontSize: '0.78rem' }}>{task.completed_after_escalation ? '⚡ After esc.' : '✓ Done'}</span>}
                              <button className="activity-toggle" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}>
                                <History size={11} /> {expandedTaskId === task.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </button>
                            </div>
                            {expandedTaskId === task.id && (
                              <div style={{ marginTop: 6 }}><ActivityLog log={task.activity_log} /></div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════
              MOBILE: CARD VIEW
          ══════════════════════════════════════════════ */}
          <div className="mobile-only">
            {loading ? (
              <div className="loading-wrap"><div className="spinner" /> Loading tasks…</div>
            ) : tasks.length === 0 ? (
              <div className="empty-state"><ClipboardList size={40} /><p>No active tasks right now.</p></div>
            ) : (
              <div className="task-cards">
                {tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUser={currentUser}
                    smsStatus={smsStatus}
                    onAction={taskAction}
                    onAssign={taskAssign}
                    actionLoading={actionLoading}
                    assignTargets={assignTargets}
                    expandedId={expandedTaskId}
                    setExpandedId={setExpandedTaskId}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Workload Panel ───────────────────────── */}
          <WorkloadPanel currentUser={currentUser} />

        </main>
      </div>

      {showCreate && (
        <CreateTaskModal
          rooms={rooms}
          departments={departments}
          allStaff={allStaff}
          currentUser={currentUser}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {showTestSms && (
        <TestSmsModal onClose={() => { setShowTestSms(false); loadAll(true); }} onDone={loadAll} />
      )}
    </div>
  );
}
