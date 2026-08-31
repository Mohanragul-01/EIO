/**
 * Shell - the persistent sidebar and top bar every page renders inside.
 *
 * The phone has a stack of full-screen pages and a home screen you return to.
 * A desktop does not need that: the sidebar is always visible, so every module
 * is one click away from every other, and there is no "back" to press.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { useAuth } from '../lib/auth';
import { useCustomModules } from '../modules/custom/useCustomModules';

/** Built-in modules, mirroring app/src/modules/registry.ts. */
const NAV = [
  { to: '/', icon: '◈', label: 'Dashboard', exact: true },
  { to: '/todo', icon: '✓', label: 'Tasks' },
  { to: '/notes', icon: '✎', label: 'Notes' },
  { to: '/finance', icon: '₹', label: 'Finance' },
  { to: '/subscriptions', icon: '↻', label: 'Subscriptions' },
  { to: '/fitness', icon: '◑', label: 'Fitness' },
];

type Theme = 'system' | 'light' | 'dark';

/**
 * Theme choice, remembered per browser.
 *
 * 'system' writes NO attribute, which is what lets the CSS fall through to
 * prefers-color-scheme. Writing data-theme="system" would match neither of the
 * explicit selectors and silently pin the site to light.
 */
function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('eio-theme');
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);

    try {
      localStorage.setItem('eio-theme', theme);
    } catch {
      // Storage blocked. The choice still applies for this visit.
    }
  }, [theme]);

  return { theme, setTheme };
}

export function Shell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { modules } = useCustomModules();
  const location = useLocation();

  // The document title follows the page, so browser tabs and history are
  // readable when several are open.
  useEffect(() => {
    document.title = title === 'Dashboard' ? 'EIO' : `${title} · EIO`;
  }, [title]);

  const cycleTheme = () =>
    setTheme(theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system');

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Modules">
        <div className="brand">
          <span className="brand-mark">EIO</span>
          <span className="brand-name">Everything in One</span>
        </div>

        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}

        {modules.length > 0 ? (
          <>
            <div
              className="overline"
              style={{ padding: 'var(--space-lg) var(--space-md) var(--space-sm)' }}
            >
              Yours
            </div>
            {modules.map((module) => (
              <NavLink
                key={module.id}
                to={`/m/${module.id}`}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon" aria-hidden style={{ color: module.color }}>
                  ●
                </span>
                <span className="truncate">{module.name}</span>
              </NavLink>
            ))}
          </>
        ) : null}

        <div className="sidebar-foot">
          <NavLink
            to="/builder"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon" aria-hidden>
              ＋
            </span>
            New module
          </NavLink>

          <button className="nav-link" onClick={cycleTheme} style={{ background: 'none' }}>
            <span className="nav-icon" aria-hidden>
              {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}
            </span>
            {theme === 'system' ? 'System theme' : theme === 'dark' ? 'Dark' : 'Light'}
          </button>

          <button className="nav-link" onClick={() => void signOut()} style={{ background: 'none' }}>
            <span className="nav-icon" aria-hidden>
              ⏻
            </span>
            Sign out
          </button>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <div className="grow">
            <div className="page-title">{title}</div>
            {subtitle ? <div className="page-sub">{subtitle}</div> : null}
          </div>
          {actions}
        </header>

        {/*
          Keyed on the path so a page's own state - a filter, a scroll
          position, a half-typed form - resets when you navigate to a different
          module, rather than leaking across.
        */}
        <main className="content" key={location.pathname}>
          {children}
        </main>
      </div>
    </div>
  );
}
