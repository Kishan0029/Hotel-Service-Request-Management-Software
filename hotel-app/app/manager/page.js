'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LogOut, Plus, X, RefreshCw, Shield, MapPin, Camera,
  ClipboardList, Clock, AlertTriangle, CheckCircle2, ArrowRight,
  Upload, Flame, Activity, ChevronDown, ChevronUp, History, Zap,
  UserCheck, PlayCircle,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';

/* ── helpers ──────────────────────────────────────────────── */
function elapsed(iso) {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function isDelayed(task) {
  if (task.status === 'completed') return false;
  return (Date.now() - new Date(task.created_at).getTime()) / 60_000 > (task.expected_time ?? 10);
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

/* ── MOD Mode Task Type options ─────────────────────────────── */
const MOD_TASK_TYPES = {
  'Housekeeping': ['Room Cleaning', 'Towels & Linen', 'Trash Removal', 'Bed Making', 'Turndown Service', 'Deep Cleaning', 'Other Cleaning'],
  'Maintenance':  ['AC Not Working', 'Light / Electrical', 'Plumbing Issue', 'TV / AV Issue', 'Door Lock Issue', 'Water Leakage', 'Safe Not Opening', 'Other Maintenance'],
};

/* ── MOD Mode Modal ──────────────────────────────────────────── */
function ModModeModal({ onClose, onCreated, user, rooms, departments, locations }) {
  const cleaningDept  = departments.find(d => d.name === 'Housekeeping' || d.name.toLowerCase().includes('housekeep'));
  const maintDept     = departments.find(d => d.name === 'Maintenance'  || d.name.toLowerCase().includes('mainten'));

  const [form, setForm] = useState({
    location_id: '',
    category:    '',  // 'Housekeeping' or 'Maintenance'
    task_type:   '',
    notes:       '',
    priority:    'urgent',
  });
  const [file, setFile]             = useState(null);
  const [preview, setPreview]       = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.location_id || !form.category || !form.task_type) {
      setError('Location, Category, and Task Type are required.'); return;
    }

    setSubmitting(true);
    try {
      // Determine department
      const deptMap = { 'Housekeeping': cleaningDept?.id, 'Maintenance': maintDept?.id };
      const deptId = deptMap[form.category];
      if (!deptId) throw new Error(`No department found for ${form.category}`);

      // Find room_id from rooms (use first room as fallback for area locations)
      const location = locations.find(l => String(l.id) === String(form.location_id));
      const isRoom   = location?.type === 'room';
      const room     = isRoom
        ? rooms.find(r => `Room ${r.room_number}` === location.name || String(r.room_number) === location.name.replace('Room ', ''))
        : rooms[0]; // For area tasks use first room (or could be null)

      if (!room) throw new Error('No rooms found. Please add rooms first.');

      const headers = { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_API_KEY };
      const taskRes = await fetch('/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          room_id:       room.id,
          department_id: deptId,
          task_type:     form.task_type,
          priority:      form.priority,
          type:          'complaint',
          notes:         form.notes || undefined,
          created_by:    user?.name ?? 'Manager',
          creator_role:  'manager',
          mod_dispatch:  true,
          location_id:   parseInt(form.location_id),
        }),
      });
      const taskData = await taskRes.json();
      if (!taskRes.ok) throw new Error(taskData.error || 'Failed to create MOD task');

      // Upload before photo if provided
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('photo_type', 'before');
        fd.append('by', user?.name ?? 'Manager');
        const photoRes = await fetch(`/api/tasks/${taskData.id}/photo`, { method: 'POST', body: fd });
        const photoData = await photoRes.json();
        if (photoRes.ok && photoData.task) {
          onCreated(photoData.task);
          onClose();
          return;
        }
      }

      onCreated(taskData);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay mod-overlay" onClick={e => e.target === e.currentTarget && onClose()} data-testid="mod-mode-modal">
      <div className="modal modal-wide">
        {/* Header */}
        <div className="modal-header mod-modal-header">
          <div className="mod-header-content">
            <div className="mod-header-icon"><Shield size={18} /></div>
            <div>
              <div className="modal-title">MOD Mode — Live Issue Report</div>
              <div className="modal-subtitle">Manager on Duty real-time dispatch</div>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} data-testid="mod-close-btn"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner" data-testid="mod-error">{error}</div>}

            {/* Location */}
            <div className="field">
              <label className="field-required">
                <MapPin size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />Location
              </label>
              <select
                value={form.location_id}
                onChange={e => set('location_id', e.target.value)}
                required
                data-testid="mod-location-select"
              >
                <option value="">Select location…</option>
                <optgroup label="Hotel Areas">
                  {locations.filter(l => l.type === 'area').map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Rooms">
                  {locations.filter(l => l.type === 'room').map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Category */}
            <div className="field">
              <label className="field-required">Task Category</label>
              <div className="type-radio-group">
                {['Housekeeping', 'Maintenance'].map(cat => (
                  <label
                    key={cat}
                    className={`type-radio ${form.category === cat ? `type-radio-${cat.toLowerCase()}` : ''}`}
                    data-testid={`mod-category-${cat.toLowerCase()}`}
                  >
                    <input
                      type="radio" name="category" value={cat}
                      checked={form.category === cat}
                      onChange={() => { set('category', cat); set('task_type', ''); }}
                      style={{ display: 'none' }}
                    />
                    {cat === 'Housekeeping' ? '🧹 Housekeeping / Cleaning' : '🔧 Maintenance / Repair'}
                  </label>
                ))}
              </div>
            </div>

            {/* Task Type */}
            <div className="field">
              <label className="field-required">Specific Issue</label>
              <select
                value={form.task_type}
                onChange={e => set('task_type', e.target.value)}
                required
                disabled={!form.category}
                data-testid="mod-task-type-select"
              >
                <option value="">{form.category ? 'Select issue type…' : 'Select category first…'}</option>
                {(MOD_TASK_TYPES[form.category] ?? []).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="field-row">
              <div className="field">
                <label>Priority</label>
                <select value={form.priority} onChange={e => set('priority', e.target.value)} data-testid="mod-priority-select">
                  <option value="urgent">Urgent</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div className="field">
              <label>Notes / Description</label>
              <textarea
                placeholder="Describe the issue in detail…"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                data-testid="mod-notes-input"
              />
            </div>

            {/* Before Photo Upload */}
            <div className="field">
              <label>
                <Camera size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Before Photo (Evidence)
              </label>
              <div
                className="photo-upload-zone"
                onClick={() => fileRef.current?.click()}
                data-testid="mod-photo-upload-zone"
              >
                {preview ? (
                  <div className="photo-preview-wrap">
                    <img src={preview} alt="Before" className="photo-preview-img" />
                    <button
                      type="button"
                      className="photo-remove-btn"
                      onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); }}
                    >
                      <X size={14} /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="photo-upload-placeholder">
                    <Upload size={28} className="photo-upload-icon" />
                    <p className="photo-upload-text">Tap to upload or capture photo</p>
                    <p className="photo-upload-hint">JPG, PNG or WEBP</p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleFile}
                  data-testid="mod-photo-input"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-mod-dispatch"
              disabled={submitting}
              data-testid="mod-dispatch-btn"
            >
              {submitting ? 'Dispatching…' : <><ArrowRight size={14} /> Dispatch &amp; Notify</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const DEPT_TASK_TYPES = {
  'Housekeeping': ['Room Cleaning', 'Towels', 'Extra Pillows', 'Extra Blanket', 'Bed Making', 'Trash Removal', 'Turndown Service'],
  'Laundry':      ['Laundry Pickup', 'Dry Cleaning', 'Express Laundry', 'Ironing', 'Laundry Return', 'Stain Treatment'],
  'Bell Desk':    ['Luggage Assistance', 'Wake-up Call', 'Taxi Booking', 'Parcel Delivery', 'Guest Arrival', 'Guest Departure'],
  'Maintenance':  ['AC Not Working', 'Light Bulb Fix', 'Plumbing Issue', 'TV / Remote Issue', 'Door Lock Issue', 'Water Leakage', 'Safe Not Opening'],
};
const FALLBACK_TASK_TYPES = ['Room Service', 'Water Bottles', 'Minibar Refill', 'Other'];

/* ── Manager Create Task Modal ─────────────────────────────────── */
function ManagerCreateTaskModal({ rooms, deptStaff, supervisors, onClose, onCreated, user }) {
  const [form, setForm] = useState({
    room_id: '', task_type: '', task_type_custom: '',
    priority: 'normal', type: 'request', notes: '', initial_assignee_id: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const assignees = [...supervisors, ...deptStaff];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const taskType = form.task_type === '__custom__' ? form.task_type_custom : form.task_type;
    if (!form.room_id || !taskType) {
      setError('Room and Task Type are required.'); return;
    }
    
    setSubmitting(true);
    try {
      const payload = {
          room_id:            parseInt(form.room_id),
          department_id:      user.department_id,
          task_type:          taskType,
          priority:           form.priority,
          type:               form.type,
          notes:              form.notes || undefined,
          created_by:         user?.name ?? 'Manager',
          creator_role:       'manager',
      };
      
      if (form.initial_assignee_id) {
          payload.initial_assignee_id = parseInt(form.initial_assignee_id);
          const targetedStaff = assignees.find(s => String(s.id) === String(form.initial_assignee_id));
          if (targetedStaff) payload.initial_assignee_role = targetedStaff.role;
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY 
        },
        body: JSON.stringify(payload),
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
          <span className="modal-title">🏨 New Request — {user.department_name}</span>
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
            {/* Room */}
            <div className="field">
              <label className="field-required">Room</label>
              <select value={form.room_id} onChange={e => set('room_id', e.target.value)} required>
                <option value="">Select room…</option>
                {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number} (Fl. {r.floor})</option>)}
              </select>
            </div>
            {/* Task Type */}
            <div className="field">
              <label className="field-required">Task Type</label>
              <select value={form.task_type} onChange={e => set('task_type', e.target.value)} required>
                <option value="">Select task type…</option>
                {(DEPT_TASK_TYPES[user.department_name] ?? FALLBACK_TASK_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                <option value="__custom__">Other (specify below)…</option>
              </select>
            </div>
            {form.task_type === '__custom__' && (
              <div className="field">
                <label className="field-required">Describe Task</label>
                <input type="text" placeholder="e.g. Special setup" value={form.task_type_custom} onChange={e => set('task_type_custom', e.target.value)} required />
              </div>
            )}
            {/* Assign */}
            <div className="field">
              <label>Assign to (Optional)</label>
              <select value={form.initial_assignee_id} onChange={e => set('initial_assignee_id', e.target.value)}>
                <option value="">Auto-assign to Supervisor</option>
                {supervisors.length > 0 && <optgroup label="Supervisors">
                  {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>}
                {deptStaff.length > 0 && <optgroup label="Staff">
                  {deptStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>}
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
              <textarea placeholder="Additional context for the assignee…" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Task Row (Manager view) ─────────────────────────────────── */
function ManagerTaskCard({ task, currentUser, onAction, onAssign, actionLoading, supervisors, deptStaff, expandedId, setExpandedId }) {
  const expanded   = expandedId === task.id;
  const busy       = !!actionLoading[task.id];
  const canAssign  = currentUser?.role === 'manager' && task.status !== 'completed';
  const hasAssignees = supervisors.length > 0 || deptStaff.length > 0;

  const icons = { created: '📋', acknowledged: '✅', started: '🔧', completed: '✓', reassigned: '↩', escalated: '🔴', assigned: '→' };

  return (
    <div
      className={`task-card-premium task-card-${task.status} ${task.is_mod_task ? 'task-card-mod' : ''} ${task.type === 'complaint' ? 'task-card-complaint' : ''} ${task.escalation_level >= 1 ? 'task-card-escalated' : ''}`}
      data-testid={`manager-task-${task.id}`}
    >
      <div className="task-card-header">
        <div className="task-card-room">
          {task.is_mod_task && <span className="mod-badge"><Shield size={10} /> MOD</span>}
          Room {task.rooms?.room_number}
        </div>
        <div className="task-card-badges">
          <StatusBadge status={task.status} />
          {task.priority === 'urgent' && <span className="badge badge-urgent"><AlertTriangle size={9}/> Urgent</span>}
        </div>
      </div>

      <div className="task-card-dept">{task.departments?.name} — {task.task_type}</div>
      {task.notes && <div className="task-card-notes">{task.notes}</div>}

      <div className="task-card-meta">
        <span>{task.assigned_staff?.name ? `→ ${task.assigned_staff.name}` : '⚠ Unassigned'}</span>
        <span>{elapsed(task.created_at)}</span>
      </div>

      {/* Before photo thumbnail */}
      {task.before_photo_url && (
        <a href={task.before_photo_url} target="_blank" rel="noopener noreferrer" className="task-photo-thumb" data-testid={`task-before-photo-${task.id}`}>
          <img src={task.before_photo_url} alt="Before" />
          <span>Before Photo</span>
        </a>
      )}

      {/* Assign dropdown — supervisors + staff */}
      {task.status !== 'completed' && canAssign && hasAssignees && (
        <select
          className="reassign-select"
          value=""
          onChange={e => onAssign(task.id, parseInt(e.target.value), currentUser.role)}
          disabled={busy}
          data-testid={`manager-assign-${task.id}`}
        >
          <option value="">→ Assign to…</option>
          {supervisors.length > 0 && (
            <optgroup label="Supervisors">
              {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
          )}
          {deptStaff.length > 0 && (
            <optgroup label="Staff">
              {deptStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
          )}
        </select>
      )}

      <button
        className="activity-toggle"
        onClick={() => setExpandedId(expanded ? null : task.id)}
        data-testid={`manager-expand-${task.id}`}
      >
        <History size={11} /> {expanded ? 'Hide' : 'History'} {expanded ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
      </button>

      {expanded && Array.isArray(task.activity_log) && task.activity_log.length > 0 && (
        <div className="activity-log">
          {[...task.activity_log].reverse().map((entry, i) => (
            <div key={i} className="activity-entry">
              <span className="activity-icon">{icons[entry.event] ?? '•'}</span>
              <span className="activity-event">{entry.event}</span>
              {entry.by && <span className="activity-by"> by {entry.by}</span>}
              <span className="activity-time">{elapsed(entry.time)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Manager Dashboard ──────────────────────────────────────── */
export default function ManagerDashboard() {
  const router = useRouter();
  const [user, setUser]               = useState(null);
  const [tasks, setTasks]             = useState([]);
  const [rooms, setRooms]             = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations]     = useState([]);
  const [allStaff, setAllStaff]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showMod, setShowMod]         = useState(false);
  const [showCreate, setShowCreate]   = useState(false);
  const [expandedId, setExpandedId]   = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [newTaskAlert, setNewTaskAlert]   = useState(null);
  const prevTaskIds = useRef(new Set());

  // Auth guard
  useEffect(() => {
    try {
      const u = localStorage.getItem('currentUser');
      if (!u) { router.replace('/login'); return; }
      const parsed = JSON.parse(u);
      if (parsed.role !== 'manager') { router.replace('/login'); return; }
      setUser(parsed);
    } catch { router.replace('/login'); }
  }, [router]);

  const loadData = useCallback(async (silent = false) => {
    if (!user) return;
    try {
      const headers = { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY };
      const [tr, rr, dr, lr, sr] = await Promise.all([
        fetch(`/api/tasks?role=manager&department_id=${user.department_id}`, { headers }),
        fetch('/api/rooms', { headers }),
        fetch('/api/departments', { headers }),
        fetch('/api/locations', { headers }),
        fetch('/api/staff', { headers }),
      ]);
      const [t, r, d, l, s] = await Promise.all([tr.json(), rr.json(), dr.json(), lr.json(), sr.json()]);
      if (!tr.ok) throw new Error(t.error);

      const newTasks = Array.isArray(t) ? t : [];
      // Detect new tasks for in-app notification
      if (!silent && prevTaskIds.current.size > 0) {
        const newOnes = newTasks.filter(task => !prevTaskIds.current.has(task.id));
        if (newOnes.length > 0) setNewTaskAlert(`${newOnes.length} new task(s) assigned to your department`);
      }
      prevTaskIds.current = new Set(newTasks.map(task => task.id));

      setTasks(newTasks);
      setRooms(Array.isArray(r) ? r : []);
      setDepartments(Array.isArray(d) ? d : []);
      setLocations(Array.isArray(l) ? l : []);
      setAllStaff(Array.isArray(s) ? s.filter(x => x.is_active) : []);
    } catch (err) {
      const isTimeout = err.name === 'AbortError' || String(err.message).toLowerCase().includes('abort') || String(err.message).toLowerCase().includes('timeout');
      if (!silent) setError(
        isTimeout
          ? 'Unable to connect to database. Please resume your Supabase project from the dashboard and apply the V7 migration SQL.'
          : err.message
      );
    }
    if (!silent) setLoading(false);
  }, [user]);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);
  useEffect(() => {
    const id = setInterval(() => { if (user) loadData(true); }, 20_000);
    return () => clearInterval(id);
  }, [user, loadData]);

  const taskAction = async (taskId, payload, actionKey) => {
    setActionLoading(prev => ({ ...prev, [taskId]: actionKey }));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_API_KEY },
        body: JSON.stringify({ ...payload, by: user?.name ?? 'Manager' }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error);
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    } catch (err) { alert('Error: ' + err.message); }
    finally { setActionLoading(prev => ({ ...prev, [taskId]: null })); }
  };

  const taskAssign = async (taskId, targetId, role) => {
    setActionLoading(prev => ({ ...prev, [taskId]: 'assign' }));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_API_KEY },
        body: JSON.stringify({ assign_to: targetId, assigner_role: role, by: user?.name }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error);
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    } catch (err) { alert('Error: ' + err.message); }
    finally { setActionLoading(prev => ({ ...prev, [taskId]: null })); }
  };

  const logout = () => { localStorage.removeItem('currentUser'); router.push('/login'); };

  if (!user || loading) {
    return (
      <div className="login-shell">
        <div className="login-loading"><div className="spinner" /><span>Loading Manager Dashboard…</span></div>
      </div>
    );
  }

  const supervisors = allStaff.filter(s => s.role === 'supervisor' && String(s.department_id) === String(user.department_id));
  const deptStaff   = allStaff.filter(s => s.role === 'staff'      && String(s.department_id) === String(user.department_id));
  const pending   = tasks.filter(t => t.status !== 'completed').length;
  const modTasks  = tasks.filter(t => t.is_mod_task).length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const delayed   = tasks.filter(isDelayed).length;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        {/* In-app notification banner */}
        {newTaskAlert && (
          <div className="new-task-alert" data-testid="new-task-alert">
            <Activity size={14} /> {newTaskAlert}
            <button onClick={() => setNewTaskAlert(null)}><X size={13}/></button>
          </div>
        )}

        {/* Role bar */}
        <div className="role-bar">
          <span className="role-bar-pill role-manager">MANAGER</span>
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{user.name}</span>
          {user.department_name && <span className="td-muted">{user.department_name}</span>}
          <div className="role-spacer" />
          <button className="btn btn-ghost btn-sm" onClick={logout} style={{ color: '#94a3b8' }} data-testid="manager-logout-btn">
            <LogOut size={13} /> Logout
          </button>
        </div>

        <header className="page-header" data-testid="manager-header">
          <div>
            <div className="page-header-title">Manager Dashboard</div>
            <div className="page-header-sub">{user.department_name} — Task Management</div>
          </div>
          <div className="header-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreate(true)}
              data-testid="manager-create-btn"
            >
              <Plus size={14} /> New Request
            </button>
            <button
              className="btn btn-mod-cta"
              onClick={() => setShowMod(true)}
              data-testid="mod-mode-btn"
            >
              <Shield size={16} />
              MOD Mode
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => loadData()}>
              <RefreshCw size={14} />
            </button>
          </div>
        </header>

        <main className="page-body">
          {error && <div className="error-banner">{error}</div>}

          {/* Stats */}
          <div className="stats-row" data-testid="manager-stats">
            <div className="stat-card stat-card-premium">
              <div className="stat-label"><Clock size={12} /> Pending</div>
              <div className="stat-value" style={{ color: '#d97706' }}>{pending}</div>
            </div>
            <div className="stat-card stat-card-premium">
              <div className="stat-label"><CheckCircle2 size={12} /> Completed</div>
              <div className="stat-value" style={{ color: '#16a34a' }}>{completed}</div>
            </div>
            <div className="stat-card stat-card-premium">
              <div className="stat-label"><AlertTriangle size={12} /> Delayed</div>
              <div className="stat-value" style={{ color: delayed > 0 ? '#dc2626' : 'inherit' }}>{delayed}</div>
            </div>
            <div className="stat-card stat-card-premium">
              <div className="stat-label"><Shield size={12} /> MOD Tasks</div>
              <div className="stat-value" style={{ color: '#7c3aed' }}>{modTasks}</div>
            </div>
          </div>

          {/* MOD Mode CTA Banner */}
          <div className="mod-cta-banner" data-testid="mod-cta-banner">
            <div className="mod-cta-content">
              <div className="mod-cta-icon"><Shield size={22} /></div>
              <div>
                <div className="mod-cta-title">Manager On Duty Mode</div>
                <div className="mod-cta-desc">Report real-time issues, upload evidence, and instantly dispatch to the concerned staff.</div>
              </div>
            </div>
            <button
              className="btn btn-mod-cta"
              onClick={() => setShowMod(true)}
              data-testid="mod-banner-btn"
            >
              <Shield size={14} /> Activate MOD Mode
            </button>
          </div>

          {/* Task List */}
          <div className="card" data-testid="manager-task-list">
            <div className="card-header">
              <span className="card-title"><ClipboardList size={14} /> Department Tasks ({tasks.length})</span>
            </div>

            {loading ? (
              <div className="loading-wrap"><div className="spinner" /> Loading tasks…</div>
            ) : tasks.length === 0 ? (
              <div className="empty-state"><CheckCircle2 size={36} /><p>No tasks yet. Use MOD Mode to report issues.</p></div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="table-wrapper desktop-only">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th><th>Location/Room</th><th>Task</th>
                        <th>Assigned To</th><th>Status</th><th>Created</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map(task => {
                        const busy  = !!actionLoading[task.id];
                        return (
                          <tr key={task.id} className={task.is_mod_task ? 'row-mod' : ''} data-testid={`manager-row-${task.id}`}>
                            <td>
                              <span className="task-code">{task.task_code}</span>
                              {task.is_mod_task && <span className="badge badge-mod ml-1"><Shield size={9}/> MOD</span>}
                            </td>
                            <td><strong>Room {task.rooms?.room_number}</strong></td>
                            <td>{task.departments?.name} — {task.task_type}</td>
                            <td>{task.assigned_staff?.name ?? <span className="td-muted">Unassigned</span>}</td>
                            <td><StatusBadge status={task.status} /></td>
                            <td className="td-muted">{elapsed(task.created_at)}</td>
                            <td>
                              <div className="action-cell">
                                {task.status !== 'completed' && (supervisors.length > 0 || deptStaff.length > 0) && (
                                  <select className="reassign-select" value="" onChange={e => taskAssign(task.id, parseInt(e.target.value), user?.role)} disabled={busy} data-testid={`table-assign-${task.id}`}>
                                    <option value="">→ Assign to…</option>
                                    {supervisors.length > 0 && (
                                      <optgroup label="Supervisors">
                                        {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                      </optgroup>
                                    )}
                                    {deptStaff.length > 0 && (
                                      <optgroup label="Staff">
                                        {deptStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                      </optgroup>
                                    )}
                                  </select>
                                )}
                                {task.before_photo_url && (
                                  <a href={task.before_photo_url} target="_blank" rel="noopener" className="btn btn-ghost btn-sm" data-testid={`table-before-photo-${task.id}`}>
                                    <Camera size={11} /> Before
                                  </a>
                                )}
                                {task.after_photo_url && (
                                  <a href={task.after_photo_url} target="_blank" rel="noopener" className="btn btn-ghost btn-sm" data-testid={`table-after-photo-${task.id}`}>
                                    <Camera size={11} /> After
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="task-cards mobile-only" style={{ padding: '12px' }}>
                  {tasks.map(task => (
                    <ManagerTaskCard
                      key={task.id}
                      task={task}
                      currentUser={user}
                      onAction={taskAction}
                      onAssign={taskAssign}
                      actionLoading={actionLoading}
                      supervisors={supervisors}
                      deptStaff={deptStaff}
                      expandedId={expandedId}
                      setExpandedId={setExpandedId}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {showMod && (
        <ModModeModal
          onClose={() => setShowMod(false)}
          onCreated={(task) => { setTasks(prev => [task, ...prev]); }}
          user={user}
          rooms={rooms}
          departments={departments}
          locations={locations}
        />
      )}

      {showCreate && (
        <ManagerCreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreated={(task) => { setTasks(prev => [task, ...prev]); }}
          user={user}
          rooms={rooms}
          deptStaff={deptStaff}
          supervisors={supervisors}
        />
      )}
    </div>
  );
}
