import PanelSection from './PanelSection';

interface Props {
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  update: (key: string, value: unknown) => void;
}

const storageClasses = [
  { value: 'STANDARD', label: 'S3 Standard', desc: 'Frequently accessed data' },
  { value: 'INTELLIGENT_TIERING', label: 'Intelligent Tiering', desc: 'Auto-optimizes cost' },
  { value: 'STANDARD_IA', label: 'Infrequent Access', desc: '~40% cheaper, retrieval fee' },
  { value: 'GLACIER', label: 'Glacier Deep Archive', desc: '~90% cheaper, 12h retrieval' },
];

export default function S3ConfigPanel({ data, update }: Props) {
  return (
    <PanelSection title="S3 Bucket Configuration" defaultOpen>
      <div className="form-group">
        <label className="form-label">Storage Class</label>
        <select className="form-select" value={data.s3StorageClass || 'STANDARD'}
          onChange={e => update('s3StorageClass', e.target.value)}
        >
          {storageClasses.map(sc => (
            <option key={sc.value} value={sc.value}>{sc.label} — {sc.desc}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Object Versioning</label>
        <button
          className="btn"
          style={{
            width: '100%', justifyContent: 'center',
            color: data.s3Versioning ? 'var(--success)' : 'var(--text-tertiary)',
            borderColor: data.s3Versioning ? 'var(--success-muted)' : 'var(--border-default)',
            background: data.s3Versioning ? 'var(--success-muted)' : 'transparent',
          }}
          onClick={() => update('s3Versioning', !data.s3Versioning)}
        >
          {data.s3Versioning ? '✓ Versioning Enabled' : 'Disabled — Click to Enable'}
        </button>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 4, display: 'block' }}>
          Keeps all versions of objects. Required for compliance (SOC2, HIPAA).
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">Block Public Access</label>
        <button
          className="btn"
          style={{
            width: '100%', justifyContent: 'center',
            color: data.s3PublicAccessBlock !== false ? 'var(--success)' : 'var(--danger)',
            borderColor: data.s3PublicAccessBlock !== false ? 'var(--success-muted)' : 'var(--danger-muted)',
            background: data.s3PublicAccessBlock !== false ? 'var(--success-muted)' : 'var(--danger-muted)',
          }}
          onClick={() => update('s3PublicAccessBlock', data.s3PublicAccessBlock === false ? true : false)}
        >
          {data.s3PublicAccessBlock !== false ? '🔒 All Public Access Blocked' : '⚠️ PUBLIC ACCESS ALLOWED (Risky)'}
        </button>
      </div>

      <div className="form-group">
        <label className="form-label">Lifecycle — Glacier Transition (days)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={0} max={365} step={1}
            value={data.s3LifecycleGlacierDays || 0}
            onChange={e => update('s3LifecycleGlacierDays', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 44, color: 'var(--text-primary)' }}>
            {data.s3LifecycleGlacierDays || 0 === 0 ? 'Off' : `${data.s3LifecycleGlacierDays}d`}
          </span>
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 4, display: 'block' }}>
          Auto-transition objects to Glacier after N days. Set 0 to disable.
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">Encryption at Rest</label>
        <button
          className="btn"
          style={{
            width: '100%', justifyContent: 'center',
            color: data.encryption !== false ? 'var(--accent)' : 'var(--text-tertiary)',
            borderColor: data.encryption !== false ? 'var(--accent-muted)' : 'var(--border-default)',
            background: data.encryption !== false ? 'var(--accent-muted)' : 'transparent',
          }}
          onClick={() => update('encryption', data.encryption === false ? true : false)}
        >
          {data.encryption !== false ? '🔒 SSE-S3 Encryption (AES-256)' : 'Disabled'}
        </button>
      </div>
    </PanelSection>
  );
}
