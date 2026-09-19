export default function DevicesPage() {
  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>Devices</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Manage registered Desktop Agent instances and enrollment status.
        </p>
      </div>
      <div className="section-card">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
          No devices enrolled yet. Enroll devices via Desktop Agent or API.
        </p>
      </div>
    </div>
  );
}
