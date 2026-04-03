'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LogOut, Camera, Upload, X, CheckCircle2, Clock, AlertTriangle,
  UserCheck, PlayCircle, RefreshCw, ClipboardList, Bell, Hotel, ChevronRight, Image as ImageIcon
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';

/* ── helpers ──────────────────────────────────────────────── */
function elapsed(iso) {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
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

/* ── After Photo Upload Sheet ────────────────────────────────── */
function AfterPhotoSheet({ task, user, onClose, onDone }) {
  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]     = useState('');
  const fileRef = useRef();
  const galleryRef = useRef();

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a photo first.'); return; }
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('photo_type', 'after');
      fd.append('by', user?.name ?? 'Staff');
      const res = await fetch(`/api/tasks/${task.id}/photo`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onDone(data.task);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal staff-photo-modal" data-testid="after-photo-sheet">
        <div className="modal-header">
          <div>
            <div className="modal-title">Upload After Photo</div>
            <div className="modal-subtitle">{task.task_type} — Room {task.rooms?.room_number}</div>
          </div>
          <button className="close-btn" onClick={onClose} data-testid="after-photo-close"><X size={18} /></button>
        </div>

        <div className="modal-body">
          {error && <div className="error-banner" data-testid="after-photo-error">{error}</div>}

          {/* Before photo reference */}
          {task.before_photo_url && (
            <div className="photo-comparison-wrap">
              <div className="photo-comparison-label">Before (Reference)</div>
              <img src={task.before_photo_url} alt="Before" className="photo-comparison-img" />
            </div>
          )}

          {/* After photo upload */}
          <div className="photo-upload-zone" data-testid="after-photo-upload-zone">
            {preview ? (
              <div className="photo-preview-wrap">
                <img src={preview} alt="After preview" className="photo-preview-img" />
                <button
                  type="button"
                  className="photo-remove-btn"
                  onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); }}
                >
                  <X size={14} /> Change
                </button>
              </div>
            ) : (
              <div className="photo-upload-placeholder">
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()} style={{ flexDirection: 'column', height: 'auto', padding: '16px 20px' }}>
                    <Camera size={28} />
                    <span style={{ fontSize: '0.8rem', marginTop: 4 }}>Take Photo</span>
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => galleryRef.current?.click()} style={{ flexDirection: 'column', height: 'auto', padding: '16px 20px' }}>
                    <ImageIcon size={28} />
                    <span style={{ fontSize: '0.8rem', marginTop: 4 }}>Gallery</span>
                  </button>
                </div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ opacity: 0, position: 'absolute', width: 1, height: 1 }}
              onChange={handleFile}
              data-testid="after-photo-input"
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              style={{ opacity: 0, position: 'absolute', width: 1, height: 1 }}
              onChange={handleFile}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-success"
            onClick={handleUpload}
            disabled={uploading || !file}
            data-testid="after-photo-submit-btn"
          >
            {uploading ? 'Uploading…' : <><CheckCircle2 size={14} /> Complete Task</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Staff Task Card ─────────────────────────────────────────── */
function StaffTaskCard({ task, user, onAction, actionLoading, onPhotoUpload }) {
  const [showSheet, setShowSheet] = useState(false);
  const [timeText, setTimeText] = useState(elapsed(task.created_at));
  const showToast = useToast();
  
  const busy = !!actionLoading[task.id];
  const isAssigned = task.assigned_to && String(task.assigned_to) === String(user?.id);
  const canAct = isAssigned && task.current_level !== 'manager';

  useEffect(() => {
    const id = setInterval(() => setTimeText(elapsed(task.created_at)), 60000);
    return () => clearInterval(id);
  }, [task.created_at]);

  return (
    <>
      <div className={`staff-task-card card-${task.status} ${task.priority === 'urgent' ? 'staff-task-urgent' : ''} ${task.status === 'completed' ? 'staff-task-done' : ''}`} data-testid={`staff-task-${task.id}`}>
      <div className="staff-task-body">
          {/* Top row */}
          <div className="staff-task-top">
            <div className="staff-task-room">Room {task.rooms?.room_number}</div>
            <div className="staff-task-badges">
              <StatusBadge status={task.status} />
              {task.priority === 'urgent' && (
                <span className="badge badge-urgent" data-testid={`staff-task-urgent-${task.id}`}>
                  <AlertTriangle size={9} /> Urgent
                </span>
              )}
            </div>
          </div>

          {/* Task info */}
          <div className="staff-task-type" data-testid={`staff-task-type-${task.id}`}>
            {task.departments?.name} — {task.task_type}
          </div>
          {task.notes && <div className="staff-task-notes">{task.notes}</div>}

          <div className="staff-task-time">{timeText}</div>

          {/* Before photo */}
          {task.before_photo_url && (
            <a
              href={task.before_photo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="staff-photo-thumb"
              data-testid={`staff-before-photo-${task.id}`}
            >
              <img src={task.before_photo_url} alt="Before" />
              <span className="staff-photo-label"><Camera size={11} /> Before Photo (tap to view)</span>
            </a>
          )}

          {/* After photo (if done) */}
          {task.after_photo_url && (
            <a
              href={task.after_photo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="staff-photo-thumb staff-photo-after"
              data-testid={`staff-after-photo-${task.id}`}
            >
              <img src={task.after_photo_url} alt="After" />
              <span className="staff-photo-label"><CheckCircle2 size={11} /> After Photo — Completed</span>
            </a>
          )}

          {/* Action buttons */}
          {task.status !== 'completed' && canAct && (
            <div className="staff-task-actions">
              {task.status === 'pending' && (
                <button
                  className="btn btn-acknowledge staff-action-btn"
                  onClick={() => onAction(task.id, { status: 'acknowledged' }, 'acknowledge')}
                  disabled={busy}
                  data-testid={`staff-ack-${task.id}`}
                >
                  <UserCheck size={16} /> {actionLoading[task.id] === 'acknowledge' ? '…' : 'Acknowledge'}
                </button>
              )}
              {task.status === 'acknowledged' && (
                <button
                  className="btn btn-start staff-action-btn"
                  onClick={() => onAction(task.id, { status: 'in_progress' }, 'start')}
                  disabled={busy}
                  data-testid={`staff-start-${task.id}`}
                >
                  <PlayCircle size={16} /> {actionLoading[task.id] === 'start' ? '…' : 'Start Work'}
                </button>
              )}
              {task.status === 'in_progress' && (
                <button
                  className="btn btn-success staff-action-btn"
                  onClick={() => setShowSheet(true)}
                  disabled={busy}
                  data-testid={`staff-complete-${task.id}`}
                >
                  <Camera size={16} /> Upload After &amp; Complete
                </button>
              )}
            </div>
          )}

          {task.status === 'completed' && (
            <div className="staff-task-completed-badge" data-testid={`staff-completed-${task.id}`}>
              <CheckCircle2 size={14} /> Task Completed
            </div>
          )}
        </div>
      </div>

      {showSheet && (
        <AfterPhotoSheet
          task={task}
          user={user}
          onClose={() => setShowSheet(false)}
          onDone={(updated) => { onPhotoUpload(updated); setShowSheet(false); }}
        />
      )}
    </>
  );
}

/* ── Staff Dashboard ─────────────────────────────────────────── */
export default function StaffDashboard() {
  const router = useRouter();
  const [user, setUser]         = useState(null);
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [newAlert, setNewAlert] = useState(null);
  const prevIds = useRef(new Set());
  const showToast = useToast();

  // Auth guard
  useEffect(() => {
    try {
      const u = localStorage.getItem('currentUser');
      if (!u) { router.replace('/login'); return; }
      const parsed = JSON.parse(u);
      if (parsed.role !== 'staff') { router.replace('/login'); return; }
      setUser(parsed);
      
      // Initialize PWA Push Notifications
      import('@/lib/push').then(m => m.setupPushNotifications(parsed.id)).catch(console.error);
    } catch { router.replace('/login'); }
  }, [router]);

  const loadTasks = useCallback(async (silent = false) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/tasks?role=staff&user_id=${user.id}`, {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newTasks = Array.isArray(data) ? data : [];

      // In-app alert for new tasks
      if (silent && prevIds.current.size > 0) {
        const newOnes = newTasks.filter(t => !prevIds.current.has(t.id));
        if (newOnes.length > 0) setNewAlert(`${newOnes.length} new task(s) assigned to you!`);
      }
      prevIds.current = new Set(newTasks.map(t => t.id));
      setTasks(newTasks);
    } catch (err) {
      const isTimeout = err.name === 'AbortError' || String(err.message).toLowerCase().includes('abort') || String(err.message).toLowerCase().includes('timeout');
      if (!silent) setError(
        isTimeout
          ? 'Unable to connect to database. Please resume your Supabase project and apply the V7 migration SQL.'
          : err.message
      );
    }
    if (!silent) setLoading(false);
  }, [user]);

  useEffect(() => { if (user) loadTasks(); }, [user, loadTasks]);
  useEffect(() => {
    const id = setInterval(() => { if (user) loadTasks(true); }, 15_000);
    return () => clearInterval(id);
  }, [user, loadTasks]);

  const taskAction = async (taskId, payload) => {
    const actionKey = payload.status;
    setActionLoading(prev => ({ ...prev, [taskId]: actionKey }));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_API_KEY },
        body: JSON.stringify({ ...payload, by: user?.name ?? 'Staff' }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error);
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      showToast({ type: 'success', message: `Task ${actionKey} successfully` });
    } catch (err) { showToast({ type: 'error', message: err.message }); }
    finally { setActionLoading(prev => ({ ...prev, [taskId]: null })); }
  };

  const handlePhotoUpload = (updatedTask) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  if (!user || loading) {
    return (
      <div className="login-shell">
        <div className="login-loading"><div className="spinner" /><span>Loading your tasks…</span></div>
      </div>
    );
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
    return new Date(b.created_at) - new Date(a.created_at); // newer first 
  });

  const activeTasks    = sortedTasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        {/* New task alert */}
        {newAlert && (
          <div className="new-task-alert" data-testid="staff-new-alert">
            <Bell size={14} /> {newAlert}
            <button onClick={() => setNewAlert(null)}><X size={13} /></button>
          </div>
        )}

        <header className="page-header" data-testid="staff-header">
          <div>
            <div className="page-header-title">My Tasks</div>
            <div className="page-header-sub">
              {user.name}
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => loadTasks()} data-testid="staff-refresh-btn" aria-label="Refresh tasks">
              <RefreshCw size={14} />
            </button>
          </div>
        </header>

        <main className="page-body">
          {error && <div className="error-banner">{error}</div>}

          {/* Stats bar */}
          <div className="stats-row" data-testid="staff-stats" style={{ marginBottom: 24 }}>
            <div className="stat-card stat-card-premium">
              <div className="stat-label">Active</div>
              <div className="stat-value">{activeTasks.length}</div>
            </div>
            <div className="stat-card stat-card-premium">
              <div className="stat-label" style={{ color: '#16a34a' }}>Completed</div>
              <div className="stat-value" style={{ color: '#16a34a' }}>{completedTasks.length}</div>
            </div>
            <div className="stat-card stat-card-premium">
              <div className="stat-label" style={{ color: '#dc2626' }}>Urgent</div>
              <div className="stat-value" style={{ color: '#dc2626' }}>{tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length}</div>
            </div>
          </div>

          {loading ? (
            <div className="loading-wrap"><div className="spinner" /> Loading tasks…</div>
          ) : tasks.length === 0 ? (
            <div className="empty-state" data-testid="staff-empty">
              <CheckCircle2 size={48} />
              <p>No tasks assigned right now</p>
            </div>
          ) : (
            <div className="staff-web-grid">
              {/* Active tasks */}
              {activeTasks.length > 0 && (
                <div className="staff-section">
                  <div className="staff-section-title">Active Tasks ({activeTasks.length})</div>
                  <div className="staff-task-list" data-testid="staff-active-tasks">
                    {activeTasks.map(task => (
                      <StaffTaskCard
                        key={task.id}
                        task={task}
                        user={user}
                        onAction={taskAction}
                        actionLoading={actionLoading}
                        onPhotoUpload={handlePhotoUpload}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed tasks */}
              {completedTasks.length > 0 && (
                <div className="staff-section">
                  <div className="staff-section-title" style={{ color: '#16a34a' }}>
                    <CheckCircle2 size={14} /> Completed Today ({completedTasks.length})
                  </div>
                  <div className="staff-task-list" data-testid="staff-completed-tasks">
                    {completedTasks.map(task => (
                      <StaffTaskCard
                        key={task.id}
                        task={task}
                        user={user}
                        onAction={taskAction}
                        actionLoading={actionLoading}
                        onPhotoUpload={handlePhotoUpload}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
