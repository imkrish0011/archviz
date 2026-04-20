import type { ArchNode } from '../../types';
import PanelSection from './PanelSection';
import { validateField, cooldownPeriodSchema } from '../../utils/validationSchemas';

interface Props {
  node: ArchNode;
  data: unknown;
  update: (key: string, value: unknown) => void;
}

export default function ScalingConfigPanel({ node, data, update }: Props) {
  return (
    <>
      <PanelSection title="Auto-Scaling" defaultOpen={false}>
        <div className="form-group">
          <label className="form-label">Min Instances</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" className="form-range" min={1} max={node.data.instances}
              value={data.minInstances || 1}
              onChange={e => update('minInstances', Number(e.target.value))}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 24, color: 'var(--text-primary)' }}>
              {data.minInstances || 1}
            </span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Max Instances</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" className="form-range" min={node.data.instances} max={50}
              value={data.maxInstances || 20}
              onChange={e => update('maxInstances', Number(e.target.value))}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 24, color: 'var(--text-primary)' }}>
              {data.maxInstances || 20}
            </span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Scale-Up Threshold (CPU %)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" className="form-range" min={40} max={95}
              value={data.scaleUpThreshold || 75}
              onChange={e => update('scaleUpThreshold', Number(e.target.value))}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 36, color: 'var(--text-primary)' }}>
              {data.scaleUpThreshold || 75}%
            </span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Scale-Down Threshold (CPU %)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" className="form-range" min={10} max={50}
              value={data.scaleDownThreshold || 25}
              onChange={e => update('scaleDownThreshold', Number(e.target.value))}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 36, color: 'var(--text-primary)' }}>
              {data.scaleDownThreshold || 25}%
            </span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Cooldown Period (seconds)</label>
          <input type="number" className={`form-input${validateField(cooldownPeriodSchema, Number(data.cooldownPeriod || 120)) ? ' form-input-error' : ''}`} min={30} max={600} step={10}
            value={data.cooldownPeriod || 120}
            onChange={e => {
              const val = Number(e.target.value);
              const err = validateField(cooldownPeriodSchema, val);
              if (!err) update('cooldownPeriod', val);
            }}
          />
          {validateField(cooldownPeriodSchema, Number(data.cooldownPeriod || 120)) && (
            <span className="form-error">{validateField(cooldownPeriodSchema, Number(data.cooldownPeriod || 120))}</span>
          )}
        </div>
      </PanelSection>
    </>
  );
}
