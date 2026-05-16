import React from 'react';

const STATUS_CONFIG = {
  queued:     { label: 'Queued',     cls: 'badge-muted' },
  preparing:  { label: 'Preparing',  cls: 'badge-muted' },
  creating_repository: { label: 'Repo Setup', cls: 'badge-info' },
  pushing_code: { label: 'Pushing', cls: 'badge-accent' },
  provisioning: { label: 'Provisioning', cls: 'badge-info' },
  scanning:   { label: 'Scanning',   cls: 'badge-info' },
  analyzing:  { label: 'Analyzing',  cls: 'badge-info' },
  uploading:  { label: 'Uploading',  cls: 'badge-accent' },
  building:   { label: 'Building',   cls: 'badge-warning' },
  deploying:  { label: 'Deploying',  cls: 'badge-accent' },
  verifying:  { label: 'Verifying',  cls: 'badge-info' },
  completed:  { label: 'Live',       cls: 'badge-success' },
  failed:     { label: 'Failed',     cls: 'badge-danger' },
  cancelled:  { label: 'Cancelled',  cls: 'badge-muted' },
  active:     { label: 'Active',     cls: 'badge-success' },
  expired:    { label: 'Expired',    cls: 'badge-muted' },
  deleted:    { label: 'Deleted',    cls: 'badge-danger' },
  clean:      { label: 'Clean',      cls: 'badge-success' },
  low:        { label: 'Low Risk',   cls: 'badge-success' },
  medium:     { label: 'Medium',     cls: 'badge-warning' },
  high:       { label: 'High Risk',  cls: 'badge-danger' },
  critical:   { label: 'Critical',   cls: 'badge-danger' },
};

export default function StatusBadge({ status, pulse = false }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'badge-muted' };
  const isLive = ['building', 'deploying', 'scanning', 'analyzing', 'uploading', 'preparing', 'creating_repository', 'pushing_code', 'provisioning', 'verifying'].includes(status);

  return (
    <span className={`badge ${cfg.cls}`} data-testid={`status-badge-${status}`} data-status={status}>
      {(isLive || pulse) && (
        <span
          className="pulse-dot"
          data-testid="pulse-dot"
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'currentColor',
            display: 'inline-block',
          }}
        />
      )}
      {cfg.label}
    </span>
  );
}
