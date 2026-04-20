import PanelSection from './PanelSection';

interface Props {
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  update: (key: string, value: unknown) => void;
}

export default function AuthConfigPanel({ data, update }: Props) {
  return (
    <>
      <PanelSection title="Authentication Settings" defaultOpen>
        <div className="form-group">
          <label className="form-label">Authentication Factors</label>
          <button
            className="btn"
            style={{
              width: '100%', justifyContent: 'center',
              color: data.mfaEnabled ? 'var(--success)' : 'var(--text-tertiary)',
              borderColor: data.mfaEnabled ? 'var(--success-muted)' : 'var(--border-default)',
              background: data.mfaEnabled ? 'var(--success-muted)' : 'transparent',
            }}
            onClick={() => update('mfaEnabled', !data.mfaEnabled)}
          >
            {data.mfaEnabled ? '🛡️ MFA Enforced' : 'Password Only (Risk)'}
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">Session Strategy</label>
          <select className="form-select" value={data.sessionStrategy || 'stateless'}
            onChange={e => update('sessionStrategy', e.target.value)}
          >
            <option value="stateless">Stateless JWT (Fast)</option>
            <option value="stateful">Stateful session ID (Redis)</option>
            <option value="cookie">HttpOnly Secure Cookie</option>
          </select>
        </div>
      </PanelSection>
    </>
  );
}
