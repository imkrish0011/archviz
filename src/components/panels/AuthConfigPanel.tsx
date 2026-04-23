import PanelSection from './PanelSection';

interface Props {
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  update: (key: string, value: unknown) => void;
}

const oauthProviders = ['google', 'github', 'apple', 'facebook', 'microsoft', 'saml'];

export default function AuthConfigPanel({ data, update }: Props) {
  const selectedProviders: string[] = data.authOAuthProviders || [];

  const toggleProvider = (provider: string) => {
    const current = [...selectedProviders];
    const idx = current.indexOf(provider);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(provider);
    update('authOAuthProviders', current);
  };

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

        <div className="form-group">
          <label className="form-label">User Pool Mode</label>
          <select className="form-select" value={data.authUserPoolMode || 'user-pool'}
            onChange={e => update('authUserPoolMode', e.target.value)}
          >
            <option value="user-pool">User Pool (Email/Password + Social)</option>
            <option value="identity-pool">Identity Pool (Federated Access Only)</option>
            <option value="both">Both (Full CIAM)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">OAuth / Social Providers</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {oauthProviders.map(p => {
              const active = selectedProviders.includes(p);
              return (
                <button
                  key={p}
                  className="btn"
                  style={{
                    padding: '4px 10px', fontSize: '0.7rem', fontWeight: 600,
                    textTransform: 'capitalize',
                    color: active ? 'var(--accent)' : 'var(--text-disabled)',
                    borderColor: active ? 'var(--accent-muted)' : 'var(--border-default)',
                    background: active ? 'var(--accent-muted)' : 'transparent',
                  }}
                  onClick={() => toggleProvider(p)}
                >
                  {active ? '✓ ' : ''}{p}
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Password Min Length</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" className="form-range" min={6} max={128}
              value={data.authPasswordMinLength || 8}
              onChange={e => update('authPasswordMinLength', Number(e.target.value))}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 32, color: 'var(--text-primary)' }}>
              {data.authPasswordMinLength || 8}
            </span>
          </div>
          {(data.authPasswordMinLength || 8) < 12 && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--warning)', marginTop: 4, display: 'block' }}>
              NIST recommends minimum 12 characters for production systems.
            </span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Token Expiry (minutes)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" className="form-range" min={5} max={10080} step={5}
              value={data.authTokenExpiryMinutes || 60}
              onChange={e => update('authTokenExpiryMinutes', Number(e.target.value))}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 52, color: 'var(--text-primary)' }}>
              {(data.authTokenExpiryMinutes || 60) >= 1440
                ? `${Math.round((data.authTokenExpiryMinutes || 60) / 1440)}d`
                : (data.authTokenExpiryMinutes || 60) >= 60
                  ? `${Math.round((data.authTokenExpiryMinutes || 60) / 60)}h`
                  : `${data.authTokenExpiryMinutes || 60}m`}
            </span>
          </div>
        </div>
      </PanelSection>
    </>
  );
}
