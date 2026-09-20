import { apiClient } from '@/lib/api-client';
import { PlatformOverviewDto } from '@pharma-signal/contracts';

export const revalidate = 0;

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString();
}

function getStatusBadgeClass(status: string): string {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
    case 'ACTIVE':
    case 'OK':
    case 'UP':
      return 'badge-success';
    case 'PROCESSING':
    case 'PENDING':
      return 'badge-info';
    case 'PARTIALLY_FAILED':
    case 'DEGRADED':
      return 'badge-warning';
    case 'FAILED':
    case 'SUSPENDED':
    case 'REVOKED':
    case 'DOWN':
      return 'badge-danger';
    default:
      return 'badge-neutral';
  }
}

export default async function DashboardOverview() {
  let overview: PlatformOverviewDto | null = null;
  let isOffline = false;

  try {
    overview = await apiClient.getPlatformOverview();
  } catch {
    isOffline = true;
  }

  const isHealthy = overview?.health.status === 'ok';

  return (
    <div>
      {/* Top Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
            Platform Overview
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Real-time status of enrolled devices, ingested data sources, and canonical sync activity.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`badge ${isOffline ? 'badge-danger' : isHealthy ? 'badge-success' : 'badge-warning'}`}>
            <span className={`status-dot ${isOffline ? 'status-dot-danger' : isHealthy ? 'status-dot-online pulse' : 'status-dot-warning'}`} />
            {isOffline ? 'BACKEND OFFLINE' : overview?.health.status.toUpperCase()}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            v{overview?.health.version ?? '0.1.0'}
          </span>
        </div>
      </div>

      {/* System Status Banner */}
      <div className="system-status-banner">
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            System Infrastructure & Connectivity
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Core services operating on Node.js runtime and PostgreSQL engine.
          </div>
        </div>
        <div className="health-indicators">
          <div className="health-pill">
            <span className={`status-dot ${overview?.health.api === 'up' ? 'status-dot-online' : 'status-dot-danger'}`} />
            <span>API Server: <strong>{overview?.health.api ? overview.health.api.toUpperCase() : 'OFFLINE'}</strong></span>
          </div>
          <div className="health-pill">
            <span className={`status-dot ${overview?.health.database === 'up' ? 'status-dot-online' : 'status-dot-danger'}`} />
            <span>PostgreSQL: <strong>{overview?.health.database ? overview.health.database.toUpperCase() : 'OFFLINE'}</strong></span>
          </div>
          <div className="health-pill">
            <span>Uptime: <strong>{overview ? formatUptime(overview.health.uptime) : '0s'}</strong></span>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid-kpi">
        <div className="card-kpi">
          <span className="card-title">Active Devices</span>
          <span className="card-value kpi-gradient">
            {overview ? overview.metrics.activeDevices : 0}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {overview ? `${overview.metrics.totalDevices} total enrolled` : '0 total enrolled'}
          </span>
        </div>

        <div className="card-kpi">
          <span className="card-title">Data Sources</span>
          <span className="card-value kpi-gradient">
            {overview ? overview.metrics.totalDataSources : 0}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Across {overview ? overview.metrics.totalBranches : 0} branches
          </span>
        </div>

        <div className="card-kpi">
          <span className="card-title">Synced Batches</span>
          <span className="card-value kpi-gradient">
            {overview ? overview.metrics.totalSyncBatches : 0}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {overview ? `${overview.metrics.totalCanonicalRecords} records in DB` : '0 records'}
          </span>
        </div>

        <div className="card-kpi">
          <span className="card-title">Tenants & Clinics</span>
          <span className="card-value kpi-gradient">
            {overview ? overview.metrics.totalOrganizations : 0}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Organizations isolated
          </span>
        </div>
      </div>

      {/* 2-Column Activity Grid */}
      <div className="dashboard-grid-2col">
        {/* Recent Sync Activity */}
        <div className="section-card">
          <div className="table-header">
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Recent Synchronization Activity</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Latest batches ingested from Desktop Agents
              </span>
            </div>
            <span className="badge badge-info">Live Stream</span>
          </div>

          {!overview || overview.recentBatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>No synchronization batches received yet.</p>
              <span style={{ fontSize: '0.8rem' }}>Connect a Desktop Agent to begin ingestion.</span>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Status</th>
                    <th>Records</th>
                    <th>Processed At</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentBatches.map((b) => (
                    <tr key={b.id}>
                      <td className="mono-text" title={b.syncBatchId}>
                        {b.syncBatchId.slice(0, 8)}...
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(b.status)}`}>
                          {b.status}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                          +{b.appliedTotal}
                        </span>
                        {b.rejectedTotal > 0 && (
                          <span style={{ color: 'var(--accent-rose)', marginLeft: '0.4rem', fontSize: '0.75rem' }}>
                            ({b.rejectedTotal} err)
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatDate(b.processedAt ?? b.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recently Enrolled Devices */}
        <div className="section-card">
          <div className="table-header">
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Recently Enrolled Devices</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Desktop Agent instances connected to platform
              </span>
            </div>
            <span className="badge badge-info">Fleet View</span>
          </div>

          {!overview || overview.recentDevices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>No devices enrolled yet.</p>
              <span style={{ fontSize: '0.8rem' }}>Enroll devices via Desktop Agent client or API.</span>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hostname</th>
                    <th>OS</th>
                    <th>Status</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentDevices.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {d.hostname}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {d.os}
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(d.status)}`}>
                          {d.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatDate(d.lastSeenAt ?? d.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
