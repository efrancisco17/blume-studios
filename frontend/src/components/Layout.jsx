import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const nav = [
  { to: '/dashboard',   icon: '◈', label: 'Dashboard' },
  { to: '/leads',       icon: '⬡', label: 'Leads' },
  { to: '/inquiry',     icon: '✉', label: 'Inquiry' },
  { to: '/queue',       icon: '⏳', label: 'Queue', badge: true },
  { to: '/prospecting', icon: '◎', label: 'Prospecting' },
  { to: '/reports',     icon: '↗', label: 'Reports' },
  { to: '/content',     icon: '✦', label: 'Content' },
  { to: '/galleries',   icon: '🖼', label: 'Galleries' },
  { to: '/settings',    icon: '⚙', label: 'Settings' },
];

export default function Layout() {
  const [queueCount, setQueueCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    fetch('/api/queue/count/pending')
      .then(r => r.json())
      .then(d => setQueueCount(d.count || 0))
      .catch(() => {});
  }, [location]);

  return (
    <div className="flex h-screen bg-white text-gray-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-30 h-full w-60 flex-shrink-0 flex flex-col
        bg-white border-r border-gray-200
        transition-transform md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="px-6 py-8 border-b border-gray-200">
          <h1 className="font-serif text-2xl text-gray-900 leading-none">Blume Studios</h1>
          <p className="text-xs text-gray-500 mt-2">Philadelphia, PA</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm transition-colors
                ${isActive
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              <span className="text-base w-4 text-center">{icon}</span>
              <span className="flex-1">{label}</span>
              {badge && queueCount > 0 && (
                <span className="bg-gray-900 text-white text-xs rounded-full px-1.5 py-0.5 leading-none font-mono">
                  {queueCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-gray-200 text-xs text-gray-500">
          v1.0 · All drafts need approval
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-serif text-lg text-gray-900">Blume Studios</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-12 bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
