import PanelSection from './PanelSection';
import { validateField, connectionTimeoutSchema } from '../../utils/validationSchemas';

interface Props {
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  update: (key: string, value: unknown) => void;
}

export default function DatabaseConfigPanel({ data, update }: Props) {
  return (
    <>
      <PanelSection title="Database Settings" defaultOpen={false}>
        <div className="form-group">
          <label className="form-label">Max Connections</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" className="form-range" min={10} max={1000} step={10}
              value={data.maxConnections || 100}
              onChange={e => update('maxConnections', Number(e.target.value))}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 36, color: 'var(--text-primary)' }}>
              {data.maxConnections || 100}
            </span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Read Replicas</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" className="form-range" min={0} max={5}
              value={data.readReplicas || 0}
              onChange={e => update('readReplicas', Number(e.target.value))}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 24, color: 'var(--text-primary)' }}>
              {data.readReplicas || 0}
            </span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Connection Timeout (ms)</label>
          <input type="number" className={`form-input${validateField(connectionTimeoutSchema, Number(data.connectionTimeout || 5000)) ? ' form-input-error' : ''}`} min={100} max={30000} step={100}
            value={data.connectionTimeout || 5000}
            onChange={e => {
              const val = Number(e.target.value);
              const err = validateField(connectionTimeoutSchema, val);
              if (!err) update('connectionTimeout', val);
            }}
          />
          {validateField(connectionTimeoutSchema, Number(data.connectionTimeout || 5000)) && (
            <span className="form-error">{validateField(connectionTimeoutSchema, Number(data.connectionTimeout || 5000))}</span>
          )}
        </div>
      </PanelSection>
    </>
  );
}
