'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, CheckCircle2, Clock, ClipboardList,
  Flame, BarChart2, Activity, LogOut, RefreshCw,
} from 'lucide-react';

/* ── Helpers ─────────────────────────────────────────────── */
function elapsed(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function delayMins(task) {
  const elapsed = (Date.now() - new Date(task.created_at).getTime()) / 60_000;
  return Math.max(0, Math.round(elapsed - (task.expected_time ?? 10)));
}

function isDelayed(task) {
  if (task.status === 'completed') return false;
  return (Date.now() - new Date(task.created_at).getTime()) / 60_000 > (task.expected_time ?? 10);
}

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
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

/* ── GM Dashboard ────────────────────────────────────────── */
export default function GmDashboard() {
  const router = useRouter();
  const [user, setUser]               = useState(null);
  const [tasks, setTasks]             = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

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
      const [tr, dr] = await Promise.all([
        fetch('/api/tasks?role=gm'),
        fetch('/api/departments'),
      ]);
      const [t, d] = await Promise.all([tr.json(), dr.json()]);
      setTasks(Array.isArray(t) ? t : []);
      setDepartments(Array.isArray(d) ? d : []);
      setLastRefresh(new Date());
    } catch {}
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

  if (!user || loading) {
    return (
      <div className="login-shell">
        <div className="login-loading"><div className="spinner" /><span>Loading GM Dashboard…</span></div>
      </div>
    );
  }

  /* ── Computed stats ──────────────────────────────────────── */
  const todayTasks    = tasks.filter(t => isToday(t.created_at));
  const pending       = tasks.filter(t => t.status !== 'completed');
  const delayed       = pending.filter(isDelayed);
  const complaints    = pending.filter(t => t.type === 'complaint');
  const escalated     = pending.filter(t => t.escalation_level >= 1);

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
      recentActivity.push({ ...entry, task_code: task.task_code, task_type: task.task_type, room: task.rooms?.room_number });
    }
  }
  recentActivity.sort((a, b) => new Date(b.time) - new Date(a.time));
  const recentSlice = recentActivity.slice(0, 20);

  const activityIcon = { created: '📋', acknowledged: '✅', started: '🔧', completed: '✓', reassigned: '↩', escalated: '🔴' };

  return (
    <div className="gm-shell">
      {/* ── Header ──────────────────────────────────────── */}
      <header className="gm-header">
        <div className="gm-header-left">
          <span className="gm-brand">🏨 Hotel Service Manager</span>
          <span className="gm-role-badge">GM VIEW</span>
        </div>
        <div className="gm-header-right">
          {lastRefresh && (
            <span className="gm-refresh-time hover-sync" onClick={loadData} style={{ cursor: 'pointer' }} title="Refresh">
              <RefreshCw size={14} style={{ marginRight: 6 }} />
              Updated {elapsed(lastRefresh)}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={logout} style={{ marginLeft: 16 }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <main className="gm-main">
        {/* ── Summary Stats ───────────────────────────── */}
        <div className="gm-stats-grid">
          <StatCard label="Total"         value={todayTasks.length} color="#1d4ed8" icon={<ClipboardList size={22} />} />
          <StatCard label="Pending"       value={pending.length}    color="#b45309" icon={<Clock size={22} />} />
          <StatCard label="Delayed"       value={delayed.length}    color="#c2410c" icon={<AlertTriangle size={22} />} />
          <StatCard label="Complaints"    value={complaints.length} color="#b91c1c" icon={<Flame size={22} />} />
          <StatCard label="Escalated"     value={escalated.length}  color="#c2410c" icon={<AlertTriangle size={22} />} />
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
                        <StatusBadge status={t.status} />
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
                        <StatusBadge status={t.status} />
                        {t.staff && <span className="td-muted">→ {t.staff.name}</span>}
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
    </div>
  );
}
