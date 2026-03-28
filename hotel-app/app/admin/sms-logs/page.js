'use client';
import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { MessageSquare, RefreshCw, CheckCircle2, AlertTriangle, ArrowDownCircle } from 'lucide-react';

function elapsed(createdAt) {
  const diff = Math.floor((Date.now() - new Date(createdAt)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(createdAt).toLocaleDateString('en-IN');
}

const EVENT_ICON = {
  sent:       <CheckCircle2 size={14} color="#22c55e" />,
  received:   <ArrowDownCircle size={14} color="#3b82f6" />,
  error:      <AlertTriangle size={14} color="#ef4444" />,
  escalation: <AlertTriangle size={14} color="#c2410c" />,
};

const STATUS_BADGE = {
  sent:     { label: 'Success',  cls: 'badge badge-completed' },
  failed:   { label: 'Failed',   cls: 'badge badge-urgent'   },
  skipped:  { label: 'Skipped',  cls: 'badge badge-normal'   },
  received: { label: 'Received', cls: 'badge badge-escalated'},
};

export default function SmsLogsPage() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/sms-logs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const id = setInterval(() => loadLogs(), 15_000);
    return () => clearInterval(id);
  }, [loadLogs]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <header className="page-header">
          <div>
            <div className="page-header-title">SMS Logs</div>
            <div className="page-header-sub">Audit trail for all SMS events</div>
          </div>
          <button className="btn btn-ghost" onClick={loadLogs} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </header>

        <main className="page-body">
          {error && <div className="error-banner">{error}</div>}

          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <MessageSquare size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Recent Events (last 100)
              </span>
            </div>

            {loading ? (
              <div className="loading-wrap"><div className="spinner" /> Loading logs…</div>
            ) : logs.length === 0 ? (
              <div className="empty-state">
                <MessageSquare size={40} />
                <p>No SMS events yet.</p>
                <p style={{ marginTop: 6 }}>SMS activity will appear here once tasks are created or replies received.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Event</th>
                      <th>Task Code</th>
                      <th>Result</th>
                      <th>Phone</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const sb = STATUS_BADGE[log.status] ?? { label: log.status, cls: 'badge' };
                      return (
                        <tr key={log.id}>
                          <td>
                            <span className="timer-cell">
                              {elapsed(log.created_at)}
                            </span>
                          </td>
                          <td>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              {EVENT_ICON[log.event_type] ?? null}
                              {log.event_type}
                            </span>
                          </td>
                          <td>
                            {log.task_code
                              ? <span className="task-code">{log.task_code}</span>
                              : <span className="td-muted">—</span>}
                          </td>
                          <td>
                            <span className={sb.cls}>
                              <span className="badge-dot" />
                              {sb.label}
                            </span>
                          </td>
                          <td className="td-muted" style={{ fontSize: '0.8rem' }}>
                            {log.phone ?? '—'}
                          </td>
                          <td style={{ maxWidth: 320, fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: 'var(--muted)' }}>
                            {log.message ?? '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
