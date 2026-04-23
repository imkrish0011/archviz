import PanelSection from './PanelSection';

interface Props {
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  update: (key: string, value: unknown) => void;
}

const runtimes = [
  { value: 'nodejs20.x', label: 'Node.js 20.x' },
  { value: 'nodejs18.x', label: 'Node.js 18.x' },
  { value: 'python3.12', label: 'Python 3.12' },
  { value: 'python3.11', label: 'Python 3.11' },
  { value: 'java21', label: 'Java 21 (Corretto)' },
  { value: 'java17', label: 'Java 17 (Corretto)' },
  { value: 'dotnet8', label: '.NET 8' },
  { value: 'go1.x', label: 'Go (provided.al2023)' },
  { value: 'ruby3.3', label: 'Ruby 3.3' },
  { value: 'rust', label: 'Rust (provided.al2023)' },
];

export default function LambdaConfigPanel({ data, update }: Props) {
  return (
    <PanelSection title="Lambda Configuration" defaultOpen>
      <div className="form-group">
        <label className="form-label">Memory Allocation (MB)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={128} max={10240} step={64}
            value={data.lambdaMemory || 512}
            onChange={e => update('lambdaMemory', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 56, color: 'var(--text-primary)' }}>
            {data.lambdaMemory || 512} MB
          </span>
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 4, display: 'block' }}>
          CPU scales linearly with memory. 1,769 MB = 1 full vCPU.
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">Timeout (seconds)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={1} max={900}
            value={data.lambdaTimeout || 15}
            onChange={e => update('lambdaTimeout', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 36, color: 'var(--text-primary)' }}>
            {data.lambdaTimeout || 15}s
          </span>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Reserved Concurrency</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={1} max={3000}
            value={data.lambdaConcurrency || 100}
            onChange={e => update('lambdaConcurrency', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 44, color: 'var(--text-primary)' }}>
            {data.lambdaConcurrency || 100}
          </span>
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 4, display: 'block' }}>
          Max simultaneous executions. Prevents runaway scaling costs.
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">Runtime</label>
        <select className="form-select" value={data.lambdaRuntime || 'nodejs20.x'}
          onChange={e => update('lambdaRuntime', e.target.value)}
        >
          {runtimes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">VPC Attachment</label>
        <button
          className="btn"
          style={{
            width: '100%', justifyContent: 'center',
            color: data.lambdaVpcAttached ? 'var(--success)' : 'var(--text-tertiary)',
            borderColor: data.lambdaVpcAttached ? 'var(--success-muted)' : 'var(--border-default)',
            background: data.lambdaVpcAttached ? 'var(--success-muted)' : 'transparent',
          }}
          onClick={() => update('lambdaVpcAttached', !data.lambdaVpcAttached)}
        >
          {data.lambdaVpcAttached ? '🔒 VPC Attached (Private Subnet)' : 'Not in VPC — Click to Attach'}
        </button>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 4, display: 'block' }}>
          Required for accessing RDS/ElastiCache in private subnets. Adds ~10s cold start.
        </span>
      </div>
    </PanelSection>
  );
}
