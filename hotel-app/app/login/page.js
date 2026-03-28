'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router   = useRouter();
  const [staff, setStaff]         = useState([]);
  const [selected, setSelected]   = useState('');
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

  // If already logged in, redirect
  useEffect(() => {
    try {
      const u = localStorage.getItem('currentUser');
      if (u) {
        const parsed = JSON.parse(u);
        router.replace(parsed.role === 'gm' ? '/gm' : '/');
      }
    } catch {}
  }, [router]);

  useEffect(() => {
    fetch('/api/login')
      .then(r => r.json())
      .then(d => { setStaff(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setError('Failed to load staff list'); setLoading(false); });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ staff_id: parseInt(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('currentUser', JSON.stringify(data));
      router.push(data.role === 'gm' ? '/gm' : '/');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  // Group staff by role for display, applying search filter
  const roleLabels = { gm: 'General Manager', manager: 'Managers', supervisor: 'Supervisors', staff: 'Staff' };
  const roleOrder  = ['gm', 'manager', 'supervisor', 'staff'];
  
  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.departments?.name && s.departments.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const grouped = roleOrder.reduce((acc, role) => {
    const members = filteredStaff.filter(s => s.role === role);
    if (members.length) acc[role] = members;
    return acc;
  }, {});

  return (
    <div className="login-shell">
      <div className="login-card premium-shadow">
        <div className="login-brand">
          <div className="login-brand-icon-premium">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          </div>
          <h1 className="login-title">Hotel Service System</h1>
          <p className="login-subtitle">Select your role to continue</p>
        </div>

        {loading ? (
          <div className="login-loading" style={{ justifyContent: 'center' }}>
            <div className="spinner" />
            <span>Loading staff framework…</span>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="login-form">
            {error && <div className="error-banner">{error}</div>}

            <div className="login-search-wrap">
              <svg className="login-search-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
              <input 
                type="text" 
                placeholder="Search name or department..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="login-search-input"
              />
            </div>

            <div className="login-list-container">
              {Object.keys(grouped).length === 0 ? (
                <div className="login-empty-state">No matching staff found</div>
              ) : (
                Object.entries(grouped).map(([role, members]) => (
                  <div key={role} className="login-role-group">
                    <div className="login-role-header">{roleLabels[role] || role}</div>
                    <div className="login-role-members">
                      {members.map(s => (
                        <div 
                          key={s.id} 
                          className={`login-member-item ${selected === s.id ? 'selected' : ''}`}
                          onClick={() => setSelected(s.id)}
                        >
                          <div className="login-member-name">{s.name}</div>
                          <div className="login-member-meta">
                            {s.role === 'gm' ? 'General Management' : (s.departments?.name ? `${roleLabels[s.role] || 'Staff'} — ${s.departments.name}` : 'Staff')}
                          </div>
                          {selected === s.id && (
                            <div className="login-member-check">
                              <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary login-btn"
              disabled={!selected || submitting}
            >
              {submitting ? 'Signing in…' : 'Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
