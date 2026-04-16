'use client';
import { Menu } from 'lucide-react';

/**
 * MobileHeader — shown ONLY on mobile (hidden on desktop via CSS).
 * Provides consistent hamburger + title across all pages.
 *
 * Layout:
 *   [ Page Title ──────────────── ☰ ]   ← top row
 *   [ Subtitle (user / role)          ]   ← second row (if provided)
 *
 * Props:
 *   title    {string} — page title
 *   subtitle {string} — optional subtitle / user name
 */
export default function MobileHeader({ title, subtitle }) {
  const openSidebar = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('openSidebar'));
    }
  };

  return (
    <div className="mobile-header mobile-only">
      {/* Top row: title LEFT — hamburger RIGHT */}
      <div className="mobile-header-top">
        <div className="mobile-header-title">{title}</div>
        <button
          className="mobile-header-menu"
          onClick={openSidebar}
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Second row: subtitle below (only if provided) */}
      {subtitle && <div className="mobile-header-sub">{subtitle}</div>}
    </div>
  );
}
