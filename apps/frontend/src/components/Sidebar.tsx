'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Server, Database, FileCode, RefreshCw } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/devices', label: 'Devices', icon: Server },
  { href: '/data-sources', label: 'Data Sources', icon: Database },
  { href: '/profiles', label: 'Profiles', icon: FileCode },
  { href: '/sync', label: 'Sync Monitoring', icon: RefreshCw }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand-header">
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
          PS
        </div>
        <div>
          <div className="brand-title">Pharma Signal</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Platform v1</div>
        </div>
      </div>

      <nav style={{ flex: 1 }}>
        <ul className="nav-list">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={item.href} className="nav-item">
                <Link href={item.href} className={isActive ? 'active' : ''}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--accent-emerald)', display: 'inline-block' }}></span>
          <span>Core Connected</span>
        </div>
      </div>
    </aside>
  );
}
