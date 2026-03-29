'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  DoorOpen,
  Hotel,
  MessageSquare,
} from 'lucide-react';

const navItems = [
  {
    section: 'Reception',
    links: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Admin',
    links: [
      { href: '/admin/staff',       label: 'Staff',       icon: Users         },
      { href: '/admin/departments', label: 'Departments', icon: Building2     },
      { href: '/admin/rooms',       label: 'Rooms',       icon: DoorOpen      },
      { href: '/admin/sms-logs',    label: 'SMS Logs',    icon: MessageSquare },
    ],
  },
];


export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem('currentUser');
      if (u) {
        const parsed = JSON.parse(u);
        setRole(parsed.role);
      }
    } catch (e) {
      console.error('Sidebar auth check failed', e);
    }
  }, []);

  // Filter sections based on role
  const visibleNavItems = navItems.filter(section => {
    if (section.section === 'Admin') {
      return ['gm', 'manager', 'reception'].includes(role);
    }
    return true;
  });

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Hotel size={20} color="#fff" />
        </div>
        <div className="sidebar-brand-name">Hotel Service</div>
        <div className="sidebar-brand-sub">Request Management</div>
      </div>

      {/* Navigation */}
      {visibleNavItems.map((section) => (
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
                {label}
              </Link>
            ))}
          </nav>
        </div>
      ))}
    </aside>
  );
}
