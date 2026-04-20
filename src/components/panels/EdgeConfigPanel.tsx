import { useArchStore } from '../../store/useArchStore';
import { X, ArrowRight, Lock, Unlock, Trash2, Link2 } from 'lucide-react';
import type { EdgeConfig } from '../../types';
import PanelSection from './PanelSection';

const protocols: EdgeConfig['protocol'][] = ['HTTPS', 'gRPC', 'WebSocket', 'TCP', 'AMQP', 'Custom'];
const dataFlows: EdgeConfig['dataFlow'][] = ['request', 'response', 'bidirectional', 'event'];
const connectionTypes = [
  { value: 'default', label: 'Default (Smooth)' },
  { value: 'sync-http', label: 'Synchronous (Solid)' },
  { value: 'async-event', label: 'Asynchronous (Dashed)' },
  { value: 'firewall-boundary', label: 'Firewall / Boundary (Red Dotted)' },
];

export default function EdgeConfigPanel() {
  const selectedEdgeId = useArchStore(s => s.selectedEdgeId);
  const edges = useArchStore(s => s.edges);
  const nodes = useArchStore(s => s.nodes);
  const selectEdge = useArchStore(s => s.selectEdge);
  const removeEdge = useArchStore(s => s.removeEdge);
  const updateEdgeConfig = useArchStore(s => s.updateEdgeConfig);

  const edge = edges.find(e => e.id === selectedEdgeId);
  if (!edge) return null;

  const config: EdgeConfig = (edge as unknown as Record<string, unknown>).config || {};
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);

  return (
    <div className="right-panel">
      {/* Header */}
      <div className="right-panel-header" style={{ background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, rgba(15, 14, 18, 0.95) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link2 size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600 }}>Connection</span>
        </div>
        <button className="btn-icon" onClick={() => selectEdge(null)}><X size={16} /></button>
      </div>

      {/* Source → Target */}
      <PanelSection title="Route" defaultOpen={true}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {sourceNode?.data.label || 'Source'}
          </span>
          <ArrowRight size={14} style={{ color: 'var(--text-disabled)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {targetNode?.data.label || 'Target'}
          </span>
        </div>
      </PanelSection>

      {/* Label */}
      <PanelSection title="Edge Label" defaultOpen={true}>
        <div className="form-group">
          <label className="form-label">Display Label</label>
          <input
            className="form-input"
            placeholder="e.g. REST API, gRPC call..."
            value={config.edgeLabel || ''}
            onChange={e => updateEdgeConfig(edge.id, { edgeLabel: e.target.value })}
          />
        </div>
      </PanelSection>

      {/* Protocol & Style */}
      <PanelSection title="Connection Style & Protocol" defaultOpen={true}>
        <div className="form-group">
          <label className="form-label">Connection Style</label>
          <select
            className="form-select"
            value={config.connectionType || 'default'}
            onChange={e => updateEdgeConfig(edge.id, { connectionType: e.target.value as EdgeConfig['connectionType'] })}
          >
            {connectionTypes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Protocol</label>
          <select
            className="form-select"
            value={config.protocol || ''}
            onChange={e => updateEdgeConfig(edge.id, { protocol: (e.target.value || undefined) as EdgeConfig['protocol'] })}
          >
            <option value="">— Select —</option>
            {protocols.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Data Flow Direction</label>
          <select
            className="form-select"
            value={config.dataFlow || ''}
            onChange={e => updateEdgeConfig(edge.id, { dataFlow: (e.target.value || undefined) as EdgeConfig['dataFlow'] })}
          >
            <option value="">— Select —</option>
            {dataFlows.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </PanelSection>

      {/* Security */}
      <PanelSection title="Security" defaultOpen={true}>
        <div className="form-group">
          <label className="form-label">IAM Action / Permission</label>
          <input
            className="form-input"
            placeholder="e.g. s3:GetObject, dynamodb:PutItem"
            value={config.iamAction || ''}
            onChange={e => updateEdgeConfig(edge.id, { iamAction: e.target.value })}
          />
        </div>
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Encrypted (TLS)</label>
          <button
            className="btn-icon"
            onClick={() => updateEdgeConfig(edge.id, { encrypted: !config.encrypted })}
            style={{ color: config.encrypted ? '#34d399' : 'var(--text-disabled)' }}
            title={config.encrypted ? 'Encrypted' : 'Not encrypted'}
          >
            {config.encrypted ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <span style={{ fontSize: '0.75rem', color: config.encrypted ? '#34d399' : 'var(--text-disabled)' }}>
            {config.encrypted ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </PanelSection>

      {/* Bandwidth & Tuning */}
      <PanelSection title="Egress & Performance" defaultOpen={true}>
        <div className="form-group">
          <label className="form-label">Avg. Payload Size (Bytes)</label>
          <input
            className="form-input"
            type="number"
            min={0}
            placeholder="e.g. 1024"
            value={config.payloadSizeBytes || ''}
            onChange={e => updateEdgeConfig(edge.id, { payloadSizeBytes: Number(e.target.value) || undefined })}
          />
        </div>
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <input
            type="checkbox"
            checked={!!config.isCrossAZ}
            onChange={e => updateEdgeConfig(edge.id, { isCrossAZ: e.target.checked })}
            style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <label className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }} onClick={() => updateEdgeConfig(edge.id, { isCrossAZ: !config.isCrossAZ })}>
            Cross-AZ Traffic (Incurs Egress Cost)
          </label>
        </div>
        <div className="form-group" style={{ marginTop: 8 }}>
          <label className="form-label">Bandwidth Requirement</label>
          <input
            className="form-input"
            placeholder="e.g. 100 Mbps, 1 Gbps"
            value={config.bandwidth || ''}
            onChange={e => updateEdgeConfig(edge.id, { bandwidth: e.target.value })}
          />
        </div>
      </PanelSection>

      {/* Actions */}
      <div className="right-panel-section" style={{ borderBottom: 'none' }}>
        <button
          style={{
            width: '100%', padding: '8px', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 6, background: 'rgba(239,68,68,0.08)', color: '#f87171',
            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
          onClick={() => { removeEdge(edge.id); selectEdge(null); }}
        >
          <Trash2 size={13} /> Remove Connection
        </button>
      </div>
    </div>
  );
}
