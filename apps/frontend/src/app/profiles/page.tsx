export default function ProfilesPage() {
  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>Profiles & Classifications</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          View database classification results, confidence scores, and heuristic evidence.
        </p>
      </div>
      <div className="section-card">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
          No profile snapshots uploaded yet.
        </p>
      </div>
    </div>
  );
}
