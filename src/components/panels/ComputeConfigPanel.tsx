import PanelSection from './PanelSection';

interface Props {
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  update: (key: string, value: unknown) => void;
}

export default function ComputeConfigPanel({ data, update }: Props) {
  return (
    <>
      <PanelSection title="Compute Details" defaultOpen={false}>
        <div className="form-group">
          <label className="form-label">Auto-Scaling Policy</label>
          <select className="form-select" value={data.scalingPolicy || 'cpu-70'}
            onChange={e => update('scalingPolicy', e.target.value)}
          >
            <option value="cpu-70">Target Tracking: 70% CPU</option>
            <option value="mem-80">Target Tracking: 80% Memory</option>
            <option value="custom">Custom Metric (SQS Deep, etc)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Container Runtime</label>
          <select className="form-select" value={data.containerRuntime || 'docker'}
            onChange={e => update('containerRuntime', e.target.value)}
          >
            <option value="docker">Docker Engine</option>
            <option value="containerd">containerd (K8s Native)</option>
            <option value="firecracker">AWS Firecracker (microVMs)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Security Protocol</label>
          <button
            className="btn"
            style={{
              width: '100%', justifyContent: 'center',
              color: data.strictTls ? 'var(--success)' : 'var(--text-tertiary)',
              borderColor: data.strictTls ? 'var(--success-muted)' : 'var(--border-default)',
              background: data.strictTls ? 'var(--success-muted)' : 'transparent',
            }}
            onClick={() => update('strictTls', !data.strictTls)}
          >
            {data.strictTls ? '🔒 Strict TLS 1.3 Enforced' : 'Allow TLS 1.2+'}
          </button>
        </div>
      </PanelSection>
    </>
  );
}
