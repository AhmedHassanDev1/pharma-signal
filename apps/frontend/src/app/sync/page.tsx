export default function SyncPage() {
  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>Sync Monitoring</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Monitor batch ingestion status, record counts, and failure diagnostics.
        </p>
      </div>
      <div className="section-card">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
          No synchronization batches recorded yet.
        </p>
      </div>
    </div>
  );
}
