'use client';

export function Header() {
  return (
    <header className="top-header">
      <div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Environment:</span>{' '}
        <strong style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>Local Development</strong>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span className="badge badge-success">API Online</span>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Tenant: <strong style={{ color: 'var(--text-primary)' }}>Default Tenant</strong>
        </div>
      </div>
    </header>
  );
}
