import type { ArchNode } from '../../types';
import PanelSection from './PanelSection';
import { validateField, backupRetentionSchema } from '../../utils/validationSchemas';

interface Props {
  node: ArchNode;
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  handleCacheRateChange?: (rate: number) => void;
  update: (key: string, value: unknown) => void;
}

export function StorageConfigPanel({ data, update }: Props) {
  return (
    <PanelSection title="Storage & Backup Settings" defaultOpen={false}>
      <div className="form-group">
        <label className="form-label">Storage Size (GB)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={10} max={5000} step={10}
            value={data.storageGB || 100}
            onChange={e => update('storageGB', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 52, color: 'var(--text-primary)' }}>
            {data.storageGB || 100} GB
          </span>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Volume Type</label>
        <select className="form-select" value={data.volumeType || 'gp3'}
          onChange={e => update('volumeType', e.target.value)}
        >
          <option value="gp3">General Purpose (gp3)</option>
          <option value="io1">Provisioned IOPS (io1)</option>
          <option value="magnetic">Magnetic (Low Cost)</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Backup Retention (days)</label>
        <input type="number" className={`form-input${validateField(backupRetentionSchema, Number(data.backupRetention || 7)) ? ' form-input-error' : ''}`} min={0} max={35}
          value={data.backupRetention || 7}
          onChange={e => {
            const val = Number(e.target.value);
            const err = validateField(backupRetentionSchema, val);
            if (!err) update('backupRetention', val);
          }}
        />
        {validateField(backupRetentionSchema, Number(data.backupRetention || 7)) && (
          <span className="form-error">{validateField(backupRetentionSchema, Number(data.backupRetention || 7))}</span>
        )}
      </div>
      <div className="form-group">
        <label className="form-label">Multi-AZ Deployment</label>
        <button
          className="btn"
          style={{
            width: '100%', justifyContent: 'center',
            color: data.multiAZ ? 'var(--success)' : 'var(--text-tertiary)',
            borderColor: data.multiAZ ? 'var(--success-muted)' : 'var(--border-default)',
            background: data.multiAZ ? 'var(--success-muted)' : 'transparent',
          }}
          onClick={() => update('multiAZ', !data.multiAZ)}
        >
          {data.multiAZ ? '✓ Enabled (High Availability)' : 'Disabled — Click to Enable'}
        </button>
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
          {data.encryption !== false ? '🔒 Encrypted (AES-256)' : 'Disabled'}
        </button>
      </div>
    </PanelSection>
  );
}

const evictionPolicies = ['allkeys-lru', 'volatile-lru', 'allkeys-random', 'volatile-ttl', 'noeviction'];

export function CacheConfigPanel({ node, data, update, handleCacheRateChange }: Props) {
  return (
    <PanelSection title="Cache Settings" defaultOpen>
      <div className="form-group">
        <label className="form-label">Cache Hit Rate</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={0} max={100}
            value={(node.data.cacheHitRate ?? 0.6) * 100}
            onChange={e => handleCacheRateChange?.(Number(e.target.value) / 100)}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 36, color: 'var(--text-primary)' }}>
            {Math.round((node.data.cacheHitRate ?? 0.6) * 100)}%
          </span>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">TTL (seconds)</label>
        <input type="number" className="form-input" min={1} max={86400}
          value={data.ttl || 3600}
          onChange={e => update('ttl', Number(e.target.value))}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Eviction Policy</label>
        <select className="form-select" value={data.evictionPolicy || 'allkeys-lru'}
          onChange={e => update('evictionPolicy', e.target.value)}
        >
          {evictionPolicies.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Max Memory (MB)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={64} max={16384} step={64}
            value={data.maxMemoryMB || 512}
            onChange={e => update('maxMemoryMB', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 52, color: 'var(--text-primary)' }}>
            {data.maxMemoryMB || 512} MB
          </span>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Cluster Mode</label>
        <button
          className="btn"
          style={{
            width: '100%', justifyContent: 'center',
            color: data.clusterMode ? 'var(--success)' : 'var(--text-tertiary)',
            borderColor: data.clusterMode ? 'var(--success-muted)' : 'var(--border-default)',
            background: data.clusterMode ? 'var(--success-muted)' : 'transparent',
          }}
          onClick={() => update('clusterMode', !data.clusterMode)}
        >
          {data.clusterMode ? '✓ Cluster Mode Enabled' : 'Standalone — Click to Enable Cluster'}
        </button>
      </div>
    </PanelSection>
  );
}

const lbAlgorithms = ['round-robin', 'least-connections', 'ip-hash', 'weighted-round-robin'];

export function LBConfigPanel({ data, update }: Props) {
  return (
    <PanelSection title="Load Balancer Settings" defaultOpen>
      <div className="form-group">
        <label className="form-label">Algorithm</label>
        <select className="form-select" value={data.lbAlgorithm || 'round-robin'}
          onChange={e => update('lbAlgorithm', e.target.value)}
        >
          {lbAlgorithms.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Sticky Sessions</label>
        <button
          className="btn"
          style={{
            width: '100%', justifyContent: 'center',
            color: data.stickySessions ? 'var(--accent)' : 'var(--text-tertiary)',
            borderColor: data.stickySessions ? 'var(--accent-muted)' : 'var(--border-default)',
            background: data.stickySessions ? 'var(--accent-muted)' : 'transparent',
          }}
          onClick={() => update('stickySessions', !data.stickySessions)}
        >
          {data.stickySessions ? '✓ Sticky Sessions Active' : 'Disabled — Click to Enable'}
        </button>
      </div>
      <div className="form-group">
        <label className="form-label">Health Check Path</label>
        <input type="text" className="form-input" placeholder="/health"
          value={data.healthCheckPath || '/health'}
          onChange={e => update('healthCheckPath', e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Idle Timeout (seconds)</label>
        <input type="number" className="form-input" min={1} max={4000}
          value={data.idleTimeout || 60}
          onChange={e => update('idleTimeout', Number(e.target.value))}
        />
      </div>
      <div className="form-group">
        <label className="form-label">SSL Termination</label>
        <button
          className="btn"
          style={{
            width: '100%', justifyContent: 'center',
            color: data.sslTermination !== false ? 'var(--success)' : 'var(--text-tertiary)',
            borderColor: data.sslTermination !== false ? 'var(--success-muted)' : 'var(--border-default)',
            background: data.sslTermination !== false ? 'var(--success-muted)' : 'transparent',
          }}
          onClick={() => update('sslTermination', data.sslTermination === false ? true : false)}
        >
          {data.sslTermination !== false ? '🔒 SSL Termination Enabled' : 'Disabled'}
        </button>
      </div>
    </PanelSection>
  );
}

export function NetworkConfigPanel({ node, data, update }: Props) {
  return (
    <PanelSection title="Network Settings" defaultOpen={false}>
      <div className="form-group">
        <label className="form-label">Rate Limit (requests/sec)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={100} max={100000} step={100}
            value={data.rateLimit || 10000}
            onChange={e => update('rateLimit', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 52, color: 'var(--text-primary)' }}>
            {(data.rateLimit || 10000).toLocaleString()}
          </span>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Connection Timeout (ms)</label>
        <input type="number" className="form-input" min={100} max={30000} step={100}
          value={data.connectionTimeout || 5000}
          onChange={e => update('connectionTimeout', Number(e.target.value))}
        />
      </div>
      {node.data.componentType === 'cdn' && (
        <>
          <div className="form-group">
            <label className="form-label">Cache TTL (seconds)</label>
            <input type="number" className="form-input" min={0} max={86400}
              value={data.cdnCacheTTL || 86400}
              onChange={e => update('cdnCacheTTL', Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Gzip Compression</label>
            <button
              className="btn"
              style={{
                width: '100%', justifyContent: 'center',
                color: data.gzipEnabled !== false ? 'var(--success)' : 'var(--text-tertiary)',
                borderColor: data.gzipEnabled !== false ? 'var(--success-muted)' : 'var(--border-default)',
                background: data.gzipEnabled !== false ? 'var(--success-muted)' : 'transparent',
              }}
              onClick={() => update('gzipEnabled', data.gzipEnabled === false ? true : false)}
            >
              {data.gzipEnabled !== false ? '✓ Compression Enabled' : 'Disabled'}
            </button>
          </div>
        </>
      )}
    </PanelSection>
  );
}

export function MessagingConfigPanel({ data, update }: Props) {
  return (
    <PanelSection title="Queue / Messaging Settings" defaultOpen={false}>
      <div className="form-group">
        <label className="form-label">Message Retention (hours)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={1} max={336}
            value={data.messageRetention || 72}
            onChange={e => update('messageRetention', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 44, color: 'var(--text-primary)' }}>
            {data.messageRetention || 72}h
          </span>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Max Message Size (KB)</label>
        <input type="number" className="form-input" min={1} max={1024}
          value={data.maxMessageSize || 256}
          onChange={e => update('maxMessageSize', Number(e.target.value))}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Dead Letter Queue</label>
        <button
          className="btn"
          style={{
            width: '100%', justifyContent: 'center',
            color: data.dlqEnabled ? 'var(--warning)' : 'var(--text-tertiary)',
            borderColor: data.dlqEnabled ? 'var(--warning-muted)' : 'var(--border-default)',
            background: data.dlqEnabled ? 'var(--warning-muted)' : 'transparent',
          }}
          onClick={() => update('dlqEnabled', !data.dlqEnabled)}
        >
          {data.dlqEnabled ? '✓ DLQ Enabled (max 3 retries)' : 'Disabled — Click to Enable'}
        </button>
      </div>
      <div className="form-group">
        <label className="form-label">Max Receive Count (before DLQ)</label>
        <input type="number" className="form-input" min={1} max={100}
          value={data.maxReceiveCount || 3}
          onChange={e => update('maxReceiveCount', Number(e.target.value))}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Batch Size</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={1} max={100}
            value={data.batchSize || 10}
            onChange={e => update('batchSize', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 24, color: 'var(--text-primary)' }}>
            {data.batchSize || 10}
          </span>
        </div>
      </div>
    </PanelSection>
  );
}

const retryStrategies = ['exponential-backoff', 'linear', 'fixed-delay', 'none'];
const healthCheckTypes = ['TCP', 'HTTP', 'HTTPS', 'gRPC'];

export function ReliabilityConfigPanel({ data, update }: Props) {
  return (
    <PanelSection title="Reliability & Resilience" defaultOpen={false}>
      <div className="form-group">
        <label className="form-label">Health Check Interval (seconds)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={5} max={300}
            value={data.healthCheckInterval || 30}
            onChange={e => update('healthCheckInterval', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 36, color: 'var(--text-primary)' }}>
            {data.healthCheckInterval || 30}s
          </span>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Health Check Type</label>
        <select className="form-select" value={data.healthCheckType || 'HTTP'}
          onChange={e => update('healthCheckType', e.target.value)}
        >
          {healthCheckTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Retry Strategy</label>
        <select className="form-select" value={data.retryStrategy || 'exponential-backoff'}
          onChange={e => update('retryStrategy', e.target.value)}
        >
          {retryStrategies.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Max Retries</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" className="form-range" min={0} max={10}
            value={data.maxRetries ?? 3}
            onChange={e => update('maxRetries', Number(e.target.value))}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 24, color: 'var(--text-primary)' }}>
            {data.maxRetries ?? 3}
          </span>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Disaster Recovery Strategy</label>
        <select className="form-select" value={data.drStrategy || 'none'}
          onChange={e => update('drStrategy', e.target.value)}
        >
          <option value="none">Single Region Deployment</option>
          <option value="backup-only">Automated Backup Vaulting</option>
          <option value="active-passive">Active-Passive (Warm Standby)</option>
          <option value="active-active">Active-Active (Multi-Region)</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Circuit Breaker</label>
        <button
          className="btn"
          style={{
            width: '100%', justifyContent: 'center',
            color: data.circuitBreaker ? 'var(--warning)' : 'var(--text-tertiary)',
            borderColor: data.circuitBreaker ? 'var(--warning-muted)' : 'var(--border-default)',
            background: data.circuitBreaker ? 'var(--warning-muted)' : 'transparent',
          }}
          onClick={() => update('circuitBreaker', !data.circuitBreaker)}
        >
          {data.circuitBreaker ? '⚡ Circuit Breaker Active' : 'Disabled — Click to Enable'}
        </button>
      </div>
      {data.circuitBreaker && (
        <div className="form-group">
          <label className="form-label">Failure Threshold (before open)</label>
          <input type="number" className="form-input" min={1} max={50}
            value={data.cbFailureThreshold || 5}
            onChange={e => update('cbFailureThreshold', Number(e.target.value))}
          />
        </div>
      )}
    </PanelSection>
  );
}
