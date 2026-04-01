'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

function getRoleRoute(role) {
  if (role === 'gm')       return '/gm';
  if (role === 'manager')  return '/manager';
  if (role === 'staff')    return '/staff';
  return '/'; // reception, supervisor
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm]           = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    try {
      const u = localStorage.getItem('currentUser');
      if (u) {
        const parsed = JSON.parse(u);
        router.replace(getRoleRoute(parsed.role));
      }
    } catch {}
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('currentUser', JSON.stringify(data));
      router.push(getRoleRoute(data.role));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell-v7">
      {/* Background image layer */}
      <div className="login-bg-overlay" />

      {/* Login card */}
      <div className="login-glass-card" data-testid="login-card">
        {/* Brand */}
        <div className="login-brand-v7">
          <h1 className="login-title-v7">Regenta Resort</h1>
          <p className="login-subtitle-v7">Hotel Management System</p>
          <div className="login-trust-badge">
            🔒 Secure Access — Authorized Personnel Only
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="login-form-v7" data-testid="login-form">
          {error && (
            <div className="login-error-v7" data-testid="login-error">
              <span>{error}</span>
            </div>
          )}

          {/* Email */}
          <div className="login-field-v7">
            <label className="login-label-v7" htmlFor="email">Email Address</label>
            <div className="login-input-wrap-v7">
              <Mail size={16} className="login-input-icon" />
              <input
                id="email"
                data-testid="login-email-input"
                type="email"
                placeholder="your.name@hotel.com"
                autoComplete="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field-v7">
            <label className="login-label-v7" htmlFor="password">Password</label>
            <div className="login-input-wrap-v7">
              <Lock size={16} className="login-input-icon" />
              <input
                id="password"
                data-testid="login-password-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword(v => !v)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            data-testid="login-submit-btn"
            disabled={loading || !form.email || !form.password}
          >
            {loading ? (
              <span className="login-btn-loading"><span className="spinner-sm" /> Signing in…</span>
            ) : (
              <span className="login-btn-text"><ArrowRight size={16} /> Sign In</span>
            )}
          </button>
        </form>

        <div className="login-footer-credits" style={{ marginTop: '45px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#8892b0', fontWeight: 500 }}>
            Engineered by Nextverse
          </p>
          <img 
            src="/images/nextverse-logo.png" 
            alt="Nextverse Logo" 
            style={{ width: '110px', filter: 'brightness(0) opacity(0.5)', objectFit: 'contain' }} 
          />
          <a href="https://gonextverse.in" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#8892b0', textDecoration: 'none', fontWeight: 500 }}>
            gonextverse.in
          </a>
        </div>

      </div>
    </div>
  );
}
