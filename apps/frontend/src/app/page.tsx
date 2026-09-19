import { apiClient } from '@/lib/api-client';

export const revalidate = 0;

export default async function DashboardOverview() {
  let healthStatus = 'checking...';
  let isApiOnline = false;

  try {
    const health = await apiClient.getHealth();
    healthStatus = health.status;
    isApiOnline = health.status === 'ok';
  } catch {
    healthStatus = 'offline';
    isApiOnline = false;
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Platform Overview
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Real-time status of enrolled devices, ingested data sources, and canonical sync activity.
        </p>
      </div>

      <div className="grid-kpi">
        <div className="card-kpi">
          <span className="card-title">Active Devices</span>
          <span className="card-value">0</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ready for enrollment</span>
        </div>

        <div className="card-kpi">
          <span className="card-title">Data Sources</span>
          <span className="card-value">0</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Discovered & registered</span>
        </div>

        <div className="card-kpi">
          <span className="card-title">Synced Batches</span>
          <span className="card-value">0</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>0 records processed</span>
        </div>

        <div className="card-kpi">
          <span className="card-title">API Status</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <span className={`badge ${isApiOnline ? 'badge-success' : 'badge-info'}`}>
              {healthStatus.toUpperCase()}
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Backend /api/v1/health</span>
        </div>
      </div>

      <div className="section-card">
        <div className="table-header">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Recent Sync Activity</h2>
          <span className="badge badge-info">Monitoring Active</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1.5rem 0', textAlign: 'center' }}>
          No synchronization batches received yet. Connect a Desktop Agent to begin ingestion.
        </p>
      </div>
    </div>
  );
}
