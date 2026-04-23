import PanelSection from './PanelSection';

interface Props {
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  update: (key: string, value: unknown) => void;
}

export default function ApiGatewayConfigPanel({ data, update }: Props) {
  return (
    <PanelSection title="API Gateway Configuration" defaultOpen>
      <div className="form-group">
        <label className="form-label">Authorization Type</label>
        <select className="form-select" value={data.apigwAuthType || 'none'}
          onChange={e => update('apigwAuthType', e.target.value)}
        >
          <option value="none">None (Open)</option>
          <option value="jwt">JWT / OAuth2 Bearer Token</option>
          <option value="iam">AWS IAM Authorization</option>
          <option value="api-key">API Key Required</option>
        </select>
        {(data.apigwAuthType || 'none') === 'none' && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4, display: 'block' }}>
            ⚠️ No authorization. Anyone can call your API endpoints.
          </span>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Rate Limit (requests/sec)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={10} max={100000} step={10}
            value={data.apigwRateLimit || 10000}
            onChange={e => update('apigwRateLimit', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 56, color: 'var(--text-primary)' }}>
            {(data.apigwRateLimit || 10000).toLocaleString()}/s
          </span>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Throttle Burst</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={10} max={10000} step={10}
            value={data.apigwThrottleBurst || 5000}
            onChange={e => update('apigwThrottleBurst', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 52, color: 'var(--text-primary)' }}>
            {(data.apigwThrottleBurst || 5000).toLocaleString()}
          </span>
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 4, display: 'block' }}>
          Max concurrent requests allowed before throttling kicks in.
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">CORS (Cross-Origin)</label>
        <button
          className="btn"
          style={{
            width: '100%', justifyContent: 'center',
            color: data.apigwCorsEnabled ? 'var(--accent)' : 'var(--text-tertiary)',
            borderColor: data.apigwCorsEnabled ? 'var(--accent-muted)' : 'var(--border-default)',
            background: data.apigwCorsEnabled ? 'var(--accent-muted)' : 'transparent',
          }}
          onClick={() => update('apigwCorsEnabled', !data.apigwCorsEnabled)}
        >
          {data.apigwCorsEnabled ? '✓ CORS Enabled (Allow-Origin: *)' : 'CORS Disabled — Click to Enable'}
        </button>
      </div>
    </PanelSection>
  );
}
