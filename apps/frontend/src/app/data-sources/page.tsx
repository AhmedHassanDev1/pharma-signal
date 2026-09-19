export default function DataSourcesPage() {
  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>Data Sources</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Inspect discovered database sources and schema snapshots.
        </p>
      </div>
      <div className="section-card">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
          No data sources registered yet.
        </p>
      </div>
    </div>
  );
}
