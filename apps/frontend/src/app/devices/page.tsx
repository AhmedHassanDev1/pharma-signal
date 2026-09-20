import { apiClient } from '@/lib/api-client';
import { DeviceListItemDto } from '@pharma-signal/contracts';

export const revalidate = 0;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  return (
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    ' ' +
    d.toLocaleDateString()
  );
}

function getStatusBadgeClass(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'badge-success';
    case 'SUSPENDED':
      return 'badge-warning';
    case 'RETIRED':
      return 'badge-danger';
    default:
      return 'badge-neutral';
  }
}

export default async function DevicesPage() {
  let devices: DeviceListItemDto[] = [];
  let isOffline = false;

  try {
    devices = await apiClient.getDevices(100);
  } catch {
    isOffline = true;
  }

  const totalCount = devices.length;
  const activeCount = devices.filter((d) => d.status === 'ACTIVE').length;
  const suspendedCount = devices.filter((d) => d.status === 'SUSPENDED').length;
  const retiredCount = devices.filter((d) => d.status === 'RETIRED').length;

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem'
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: '0.5rem'
            }}
          >
            Device Fleet Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Monitor and audit all enrolled Desktop Agent instances across healthcare facilities.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            className={`badge ${
              isOffline ? 'badge-danger' : 'badge-info'
            }`}
          >
            <span
              className={`status-dot ${
                isOffline ? 'status-dot-danger' : 'status-dot-online pulse'
              }`}
            />
            {isOffline ? 'BACKEND OFFLINE' : `${totalCount} DEVICES REGISTERED`}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-kpi">
        <div className="card-kpi">
          <span className="card-title">Total Enrolled</span>
          <span className="card-value kpi-gradient">{totalCount}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Across all pharmacy tenants
          </span>
        </div>

        <div className="card-kpi">
          <span className="card-title">Active Devices</span>
          <span className="card-value kpi-gradient" style={{ color: 'var(--accent-emerald)' }}>
            {activeCount}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Sending heartbeats & syncs
          </span>
        </div>

        <div className="card-kpi">
          <span className="card-title">Suspended</span>
          <span className="card-value kpi-gradient" style={{ color: 'var(--accent-amber)' }}>
            {suspendedCount}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Temporarily paused
          </span>
        </div>

        <div className="card-kpi">
          <span className="card-title">Retired</span>
          <span className="card-value kpi-gradient" style={{ color: 'var(--accent-rose)' }}>
            {retiredCount}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Permanently decommissioned
          </span>
        </div>
      </div>

      {/* Devices Table Section */}
      <div className="section-card">
        <div className="table-header">
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Enrolled Agent Instances</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Hardware details, network identity, and tenant organization mapping
            </span>
          </div>
          <span className="badge badge-info">Fleet Inventory</span>
        </div>

        {isOffline ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--accent-rose)' }}>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Failed to load device fleet.</p>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Could not communicate with the Backend API at localhost:3000. Please ensure the backend is running.
            </span>
          </div>
        ) : devices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              No devices enrolled yet
            </p>
            <span style={{ fontSize: '0.85rem' }}>
              Generate an enrollment token in the management portal and configure a Desktop Agent instance to connect.
            </span>
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hostname & Instance ID</th>
                  <th>Organization & Branch</th>
                  <th>OS & Version</th>
                  <th>Data Sources</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                  <th>Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {d.hostname}
                      </div>
                      <div className="mono-text" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }} title={d.agentInstanceId}>
                        ID: {d.agentInstanceId.slice(0, 8)}...
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {d.organizationName}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {d.branchName}
                      </div>
                    </td>
                    <td>
                      <div style={{ color: 'var(--text-primary)' }}>{d.os}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        v{d.appVersion}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">
                        {d.dataSourcesCount} source{d.dataSourcesCount === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(d.status)}`}>
                        <span
                          className={`status-dot ${
                            d.status === 'ACTIVE'
                              ? 'status-dot-online'
                              : d.status === 'SUSPENDED'
                              ? 'status-dot-warning'
                              : 'status-dot-danger'
                          }`}
                        />
                        {d.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {formatDate(d.lastSeenAt)}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {formatDate(d.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
