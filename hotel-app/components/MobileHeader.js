'use client';

/**
 * MobileHeader — shown ONLY on mobile (hidden on desktop via CSS).
 * Provides consistent hamburger + title across all pages.
 *
 * Layout:
 *   [ Page Title ─────────────── ☰ ]   ← top row (flex space-between)
 *   [ Subtitle (user / role)        ]   ← second row (if provided)
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
      {/* Top row: title LEFT — hamburger RIGHT, both vertically centred */}
      <div className="mobile-header-top">
        <div className="mobile-header-title">{title}</div>

        <button
          className="mobile-header-menu"
          onClick={openSidebar}
          aria-label="Open navigation menu"
        >
          {/* Inline SVG 3-line hamburger — no dependency, no centering issues */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <line x1="3" y1="6"  x2="21" y2="6"  />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Second row: subtitle below (only rendered when provided) */}
      {subtitle && <div className="mobile-header-sub">{subtitle}</div>}
    </div>
  );
}
