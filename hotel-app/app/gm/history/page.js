'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Search, ArrowLeft } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import MobileHeader from '@/components/MobileHeader';
import { useToast } from '@/components/Toast';

function elapsed(iso) {
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

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const showToast = useToast();

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
    if (!date) return;
    setLoading(true);
    try {
      // Pass the selected date so we can fetch tasks or filter client side
      // Currently /api/tasks doesn't filter by date natively for gm if we just pass role=gm, 
      // but let's fetch all and filter client side for simplicity, or we check if backend supports it.
      const res = await fetch('/api/tasks?role=gm', {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY },
      });
      if (!res.ok) throw new Error('Failed to load tasks');
      const allTasks = await res.json();
      
      const targetDate = new Date(date).toISOString().split('T')[0];
      const filtered = (Array.isArray(allTasks) ? allTasks : []).filter(t => {
        const tDate = new Date(t.created_at).toISOString().split('T')[0];
        return tDate === targetDate;
      });
      
      setTasks(filtered);
    } catch (err) {
      showToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [date, showToast]);

  useEffect(() => { if (user) loadData(); }, [user, date, loadData]);

  if (!user) return <div className="login-shell"><div className="login-loading"><div className="spinner"/></div></div>;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        {/* Mobile Header */}
        <MobileHeader title="History" subtitle={user.name} />

        <header className="page-header desktop-only">
          <div>
            <div className="page-header-title">History</div>
            <div className="page-header-sub">View past logs and requests by date</div>
          </div>
        </header>

        <main className="page-body">
          <div className="filter-bar">
            <div className="filter-field" style={{ width: 'auto' }}>
              <Calendar size={14} className="filter-icon" />
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                className="filter-input"
                style={{ width: '130px' }}
              />
            </div>
            <button className="btn btn-primary btn-sm" onClick={loadData} style={{ marginLeft: '4px' }}>
              <Search size={14} /> Fetch
            </button>
          </div>
          {loading ? (
            <div style={{ padding: '20px' }}>Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px' }}>
              <Calendar size={32} />
              <p>No tasks found for {date}</p>
            </div>
          ) : (
            <div className="gm-section">
              <div className="gm-section-title">Tasks on {date} ({tasks.length})</div>
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
                      <span className="td-muted">Created at: {new Date(t.created_at).toLocaleTimeString()}</span>
                      {t.completed_at && <span className="td-muted"> · Completed at: {new Date(t.completed_at).toLocaleTimeString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
