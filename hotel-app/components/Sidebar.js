'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Building2, DoorOpen,
  MessageSquare, Shield, ClipboardList, Menu, X, LogOut, Calendar
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const ALL_NAV = {
  gm: [
    {
      section: 'Overview',
      links: [
        { href: '/gm', label: 'GM Dashboard', icon: LayoutDashboard },
        { href: '/gm/history', label: 'History', icon: Calendar },
      ],
    },
    {
      section: 'Admin',
      links: [
        { href: '/admin/staff',       label: 'Staff',       icon: Users      },
        { href: '/admin/departments', label: 'Departments', icon: Building2  },
        { href: '/admin/rooms',       label: 'Rooms',       icon: DoorOpen   },
        { href: '/admin/sms-logs',    label: 'SMS Logs',    icon: MessageSquare },
      ],
    },
  ],
  manager: [
    {
      section: 'Manager',
      links: [{ href: '/manager', label: 'My Dashboard', icon: Shield }],
    },
    {
      section: 'Admin',
      links: [
        { href: '/admin/staff', label: 'Staff', icon: Users },
      ],
    },
  ],
  reception: [
    {
      section: 'Reception',
      links: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }],
    },
  ],
  supervisor: [
    {
      section: 'Supervisor',
      links: [{ href: '/', label: 'Dashboard', icon: ClipboardList }],
    },
  ],
  staff: [
    {
      section: 'My Tasks',
      links: [{ href: '/staff', label: 'My Tasks', icon: ClipboardList }],
    },
  ],
};

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  const logout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      localStorage.removeItem('currentUser');
      router.push('/login');
    }
  };

  useEffect(() => {
    const checkRole = () => {
      try {
        const u = localStorage.getItem('currentUser');
        if (u) setRole(JSON.parse(u).role);
        else    setRole(null);
      } catch { setRole(null); }
    };
    checkRole();
    window.addEventListener('storage', checkRole);
    return () => window.removeEventListener('storage', checkRole);
  }, []);

  // Close sidebar on navigation on mobile
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navItems = (role && ALL_NAV[role]) || ALL_NAV.reception;

  return (
    <>
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Mobile Header (Close Button) */}
        <div className="mobile-only" style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-icon" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--primary)', letterSpacing: '-0.02em' }}>R</span>
          </div>
          <div className="sidebar-brand-name">Regenta Resort</div>
          <div className="sidebar-brand-sub">Hotel Management</div>
        </div>

        {/* Role badge */}
        {role && (
          <div className="sidebar-role-badge">
            <span className={`sidebar-role-pill role-${role}`}>{role.toUpperCase()}</span>
          </div>
        )}

        {/* Navigation */}
        {navItems.map((section) => (
          <div key={section.section}>
            <div className="sidebar-section-label">{section.section}</div>
            <nav className="sidebar-nav">
              {section.links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`sidebar-link ${pathname === href ? 'active' : ''}`}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </div>
        ))}
        {/* Logout at bottom */}
        <div style={{ marginTop: 'auto', padding: '16px 20px 8px', borderTop: '1px solid var(--sidebar-border)' }}>
          <button 
            className="sidebar-link" 
            onClick={logout}
            style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
          <div style={{ padding: '10px 10px 6px', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
            Developed by Nextverse
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop overlay */}
      {mobileOpen && (
        <div className="mobile-overlay mobile-only" onClick={() => setMobileOpen(false)} />
      )}

      {/* Floating Action Button (Mobile Only) */}
      {!mobileOpen && (
        <button className="mobile-sidebar-toggle mobile-only" onClick={() => setMobileOpen(true)}>
          <Menu size={24} />
        </button>
      )}
    </>
  );
}
