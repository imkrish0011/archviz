import PanelSection from './PanelSection';

interface Props {
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  update: (key: string, value: unknown) => void;
}

const nodeInstanceTypes = [
  { value: 't3.medium', label: 't3.medium (2 vCPU, 4 GB)' },
  { value: 't3.large', label: 't3.large (2 vCPU, 8 GB)' },
  { value: 'm5.xlarge', label: 'm5.xlarge (4 vCPU, 16 GB)' },
  { value: 'm5.2xlarge', label: 'm5.2xlarge (8 vCPU, 32 GB)' },
  { value: 'c5.2xlarge', label: 'c5.2xlarge (8 vCPU, 16 GB) — Compute Opt' },
  { value: 'r5.2xlarge', label: 'r5.2xlarge (8 vCPU, 64 GB) — Memory Opt' },
  { value: 'c6g.4xlarge', label: 'c6g.4xlarge (16 vCPU, 32 GB) — Graviton' },
];

export default function KubernetesConfigPanel({ data, update }: Props) {
  return (
    <PanelSection title="Kubernetes Cluster Config" defaultOpen>
      <div className="form-group">
        <label className="form-label">Worker Node Instance Type</label>
        <select className="form-select" value={data.k8sNodeInstanceType || 't3.large'}
          onChange={e => update('k8sNodeInstanceType', e.target.value)}
        >
          {nodeInstanceTypes.map(n => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Min Nodes (Auto-Scaling Group)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={1} max={20}
            value={data.k8sMinNodes || 2}
            onChange={e => update('k8sMinNodes', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 24, color: 'var(--text-primary)' }}>
            {data.k8sMinNodes || 2}
          </span>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Max Nodes (Auto-Scaling Group)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={1} max={100}
            value={data.k8sMaxNodes || 10}
            onChange={e => update('k8sMaxNodes', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 32, color: 'var(--text-primary)' }}>
            {data.k8sMaxNodes || 10}
          </span>
        </div>
        {(data.k8sMinNodes || 2) > (data.k8sMaxNodes || 10) && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4, display: 'block' }}>
            ⚠️ Min nodes exceeds max nodes. Auto-scaling will not work.
          </span>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Namespace</label>
        <input type="text" className="form-input" placeholder="default"
          value={data.k8sNamespace || 'default'}
          onChange={e => update('k8sNamespace', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Fargate Profiles</label>
        <button
          className="btn"
          style={{
            width: '100%', justifyContent: 'center',
            color: data.k8sFargateEnabled ? 'var(--accent)' : 'var(--text-tertiary)',
            borderColor: data.k8sFargateEnabled ? 'var(--accent-muted)' : 'var(--border-default)',
            background: data.k8sFargateEnabled ? 'var(--accent-muted)' : 'transparent',
          }}
          onClick={() => update('k8sFargateEnabled', !data.k8sFargateEnabled)}
        >
          {data.k8sFargateEnabled ? '✓ Fargate Enabled (Serverless Pods)' : 'EC2 Managed Nodes — Click for Fargate'}
        </button>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 4, display: 'block' }}>
          Fargate runs pods without managing EC2 instances. Pay per vCPU/GB per second.
        </span>
      </div>
    </PanelSection>
  );
}
