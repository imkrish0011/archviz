import { useState } from 'react';
import { useArchStore } from '../store/useArchStore';
import { getComponentDefinition } from '../data/componentLibrary';
import componentLibrary from '../data/componentLibrary';
import { getAllCategories, getCategoryLabel } from '../data/componentLibrary';
import { getComponentCost, formatCostFull } from '../engine/costEngine';
import { useSimulation } from '../hooks/useSimulation';
import { X, Trash2, Info, Copy, ChevronDown, ChevronRight, Power, PowerOff, RefreshCw, Link2, Lock, Unlock, ArrowRight } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { ArchNode, EdgeConfig } from '../types';
import { validateField, connectionTimeoutSchema, backupRetentionSchema, cooldownPeriodSchema } from '../utils/validationSchemas';

/* ── Helpers ── */
const dbTypes = ['postgresql', 'mysql', 'mongodb', 'cassandra', 'dynamodb', 'aurora-serverless', 'bigtable'];
const cacheTypes = ['redis', 'memcached'];
const computeTypes = ['api-server', 'web-server', 'websocket-server', 'worker', 'graphql-server', 'game-server', 'lambda', 'ecs-fargate', 'app-runner', 'batch', 'ml-worker'];
const networkTypes = ['load-balancer', 'cdn', 'api-gateway', 'dns', 'waf', 'nat-gateway'];
const messagingTypes = ['sqs', 'sns', 'kafka', 'message-queue', 'eventbridge', 'kinesis', 'step-functions'];

const regions = [
  'us-east-1 (N. Virginia)',
  'us-west-2 (Oregon)',
  'eu-west-1 (Ireland)',
  'eu-central-1 (Frankfurt)',
  'ap-south-1 (Mumbai)',
  'ap-southeast-1 (Singapore)',
  'ap-northeast-1 (Tokyo)',
  'sa-east-1 (São Paulo)',
];

const evictionPolicies = ['allkeys-lru', 'volatile-lru', 'allkeys-random', 'volatile-ttl', 'noeviction'];
const lbAlgorithms = ['round-robin', 'least-connections', 'ip-hash', 'weighted-round-robin'];
const retryStrategies = ['exponential-backoff', 'linear', 'fixed-delay', 'none'];
const healthCheckTypes = ['TCP', 'HTTP', 'HTTPS', 'gRPC'];

const protocols: EdgeConfig['protocol'][] = ['HTTPS', 'gRPC', 'WebSocket', 'TCP', 'AMQP', 'Custom'];
const dataFlows: EdgeConfig['dataFlow'][] = ['request', 'response', 'bidirectional', 'event'];

/* ── Collapsible Section ── */
function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="right-panel-section">
      <div
        className="right-panel-section-title"
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none' }}
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </div>
      {open && children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Edge Configuration Panel
   ═══════════════════════════════════════════════════ */
function EdgeConfigPanel() {
  const selectedEdgeId = useArchStore(s => s.selectedEdgeId);
  const edges = useArchStore(s => s.edges);
  const nodes = useArchStore(s => s.nodes);
  const selectEdge = useArchStore(s => s.selectEdge);
  const removeEdge = useArchStore(s => s.removeEdge);
  const updateEdgeConfig = useArchStore(s => s.updateEdgeConfig);

  const edge = edges.find(e => e.id === selectedEdgeId);
  if (!edge) return null;

  const config: EdgeConfig = (edge as any).config || {};
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
      <Section title="Route" defaultOpen={true}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {sourceNode?.data.label || 'Source'}
          </span>
          <ArrowRight size={14} style={{ color: 'var(--text-disabled)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {targetNode?.data.label || 'Target'}
          </span>
        </div>
      </Section>

      {/* Label */}
      <Section title="Edge Label" defaultOpen={true}>
        <div className="form-group">
          <label className="form-label">Display Label</label>
          <input
            className="form-input"
            placeholder="e.g. REST API, gRPC call..."
            value={config.edgeLabel || ''}
            onChange={e => updateEdgeConfig(edge.id, { edgeLabel: e.target.value })}
          />
        </div>
      </Section>

      {/* Protocol */}
      <Section title="Protocol" defaultOpen={true}>
        <div className="form-group">
          <label className="form-label">Protocol</label>
          <select
            className="form-select"
            value={config.protocol || ''}
            onChange={e => updateEdgeConfig(edge.id, { protocol: (e.target.value || undefined) as any })}
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
            onChange={e => updateEdgeConfig(edge.id, { dataFlow: (e.target.value || undefined) as any })}
          >
            <option value="">— Select —</option>
            {dataFlows.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </Section>

      {/* Security */}
      <Section title="Security" defaultOpen={true}>
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
      </Section>

      {/* Bandwidth */}
      <Section title="Performance" defaultOpen={false}>
        <div className="form-group">
          <label className="form-label">Bandwidth</label>
          <input
            className="form-input"
            placeholder="e.g. 100 Mbps, 1 Gbps"
            value={config.bandwidth || ''}
            onChange={e => updateEdgeConfig(edge.id, { bandwidth: e.target.value })}
          />
        </div>
      </Section>

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

/* ═══════════════════════════════════════════════════
   Main Right Panel (Node Config)
   ═══════════════════════════════════════════════════ */
export default function RightPanel() {
  const selectedNodeId = useArchStore(s => s.selectedNodeId);
  const selectedEdgeId = useArchStore(s => s.selectedEdgeId);
  const nodes = useArchStore(s => s.nodes);
  const edges = useArchStore(s => s.edges);
  const updateNodeData = useArchStore(s => s.updateNodeData);
  const removeNode = useArchStore(s => s.removeNode);
  const removeEdge = useArchStore(s => s.removeEdge);
  const selectNode = useArchStore(s => s.selectNode);
  const changeNodeType = useArchStore(s => s.changeNodeType);
  const { nodeHealth } = useSimulation();

  // If an edge is selected, show edge config
  if (selectedEdgeId && !selectedNodeId) {
    return <EdgeConfigPanel />;
  }

  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) return null;

  const def = getComponentDefinition(node.data.componentType);
  if (!def) return null;

  const cost = getComponentCost(node as ArchNode);
  const health = nodeHealth.get(node.id);

  const isDB = dbTypes.includes(node.data.componentType);
  const isCache = cacheTypes.includes(node.data.componentType);
  const isCompute = computeTypes.includes(node.data.componentType);
  const isNetwork = networkTypes.includes(node.data.componentType);
  const isMessaging = messagingTypes.includes(node.data.componentType);
  const isLB = node.data.componentType === 'load-balancer';
  const isAuth = ['auth0', 'aws-cognito'].includes(node.data.componentType);

  /* ── Updaters ── */
  const handleTierChange = (tierIndex: number) => {
    const tier = def.tiers[tierIndex];
    if (tier) updateNodeData(node.id, { tier, tierIndex });
  };

  const handleInstanceChange = (instances: number) => {
    updateNodeData(node.id, { instances: Math.max(1, Math.min(20, instances)) });
  };

  const handleCacheRateChange = (rate: number) => {
    updateNodeData(node.id, { cacheHitRate: rate });
  };

  const update = (key: string, value: unknown) => {
    updateNodeData(node.id, { [key]: value } as any);
  };

  const handleDuplicate = () => {
    const newNodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newNode = {
      ...node,
      id: newNodeId,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
    };
    useArchStore.getState().setNodes([...nodes, newNode]);
    useArchStore.getState().takeSnapshot('Duplicated component');
    selectNode(newNodeId);
  };


  const data = node.data as any;

  const catColor = `var(--cat-${def.category})`;
  const catMuted = `var(--cat-${def.category}-muted)`;

  // Count connections
  const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
  const healthColor = health?.status === 'critical' ? '#f87171' : health?.status === 'warning' ? '#fbbf24' : '#34d399';
  const healthLabel = health?.status === 'critical' ? 'Critical' : health?.status === 'warning' ? 'Warning' : 'Healthy';

  return (
    <div className="right-panel">
      {/* ── Premium Header ── */}
      <div 
        className="right-panel-header"
        style={{ 
          background: `linear-gradient(180deg, var(--cat-${def.category}-subtle) 0%, rgba(12, 11, 15, 0.95) 100%)`,
          padding: '16px 20px',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Category icon glow */}
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: catMuted,
              border: `1px solid ${catColor}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 12px ${catColor}15`,
            }}>
              {(() => {
                const IconComp = (Icons as any)[def.icon] || Icons.Box;
                return <IconComp size={16} style={{ color: catColor }} />;
              })()}
            </div>
            <div>
              <input
                value={node.data.label}
                onChange={e => updateNodeData(node.id, { label: e.target.value })}
                style={{
                  background: 'transparent', border: 'none', borderBottom: '1px solid transparent',
                  color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 650, width: '100%',
                  outline: 'none', padding: '0', letterSpacing: '-0.01em',
                  fontFamily: 'var(--font-sans)',
                }}
                onFocus={e => (e.target.style.borderBottom = `1px solid ${catColor}`)}
                onBlur={e => (e.target.style.borderBottom = '1px solid transparent')}
              />
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: 2, letterSpacing: '0.04em' }}>
                {def.category.toUpperCase()} · {def.type}
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={() => selectNode(null)} style={{ color: 'rgba(255,255,255,0.3)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Status Strip */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Health badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 20,
            background: `${healthColor}12`, border: `1px solid ${healthColor}25`,
            fontSize: '0.65rem', fontWeight: 600, color: healthColor,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: healthColor }} />
            {healthLabel}
          </div>
          {/* Cost badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 20,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}>
            ${cost.toFixed(0)}/mo
          </div>
          {/* Instances badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 20,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)',
          }}>
            ×{node.data.instances} instance{node.data.instances > 1 ? 's' : ''}
          </div>
          {/* Connections badge */}
          {connectedEdges.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 20,
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
              fontSize: '0.65rem', fontWeight: 600, color: '#818cf8',
            }}>
              {connectedEdges.length} link{connectedEdges.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* ── Description ── */}
      <div className="right-panel-section" style={{ paddingTop: 12, paddingBottom: 12 }}>
        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.65, margin: 0 }}>
          {def.description}
        </p>
      </div>

      {/* ── Architectural Note ── */}
      {node.data.architecturalNote && (
        <div className="right-panel-section" style={{ 
          background: 'rgba(94, 234, 212, 0.03)', 
          borderLeft: '2px solid var(--accent)',
          paddingTop: 10, paddingBottom: 10,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Info size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: 0 }}>
              {node.data.architecturalNote}
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* CHANGE COMPONENT TYPE */}
      {/* ═══════════════════════════════════════════════════ */}
      <Section title="Change Component" defaultOpen={false}>
        <div className="form-group">
          <label className="form-label">
            <RefreshCw size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
            Swap to a different component
          </label>
          <select
            className="form-select"
            value={node.data.componentType}
            onChange={e => changeNodeType(node.id, e.target.value)}
          >
            {getAllCategories().map(cat => (
              <optgroup key={cat} label={getCategoryLabel(cat)}>
                {componentLibrary
                  .filter(c => c.category === cat)
                  .map(c => (
                    <option key={c.type} value={c.type}>
                      {c.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-disabled)', marginTop: 4, display: 'block' }}>
            Keeps position & connections. Resets tier to default.
          </span>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* CONNECTIONS — Edge Management */}
      {/* ═══════════════════════════════════════════════════ */}
      {connectedEdges.length > 0 && (
        <Section title={`Connections (${connectedEdges.length})`} defaultOpen={false}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {connectedEdges.map(edge => {
                const otherNodeId = edge.source === node.id ? edge.target : edge.source;
                const otherNode = nodes.find(n => n.id === otherNodeId);
                const isOutgoing = edge.source === node.id;
                const otherDef = otherNode ? getComponentDefinition(otherNode.data.componentType) : null;
                const otherColor = otherDef ? `var(--cat-${otherDef.category})` : 'var(--text-secondary)';
                return (
                  <div
                    key={edge.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px', 
                      background: 'rgba(255,255,255,0.02)', 
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.04)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ 
                        fontSize: '0.6rem', fontWeight: 700, 
                        color: isOutgoing ? '#818cf8' : '#f472b6',
                        background: isOutgoing ? 'rgba(129,140,248,0.1)' : 'rgba(244,114,182,0.1)',
                        padding: '2px 5px', borderRadius: 4,
                      }}>
                        {isOutgoing ? 'OUT' : 'IN'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: otherColor, fontWeight: 500 }}>
                        {otherNode?.data.label || 'Unknown'}
                      </span>
                    </div>
                    <button
                      className="btn-icon"
                      style={{ width: 22, height: 22, minWidth: 22, color: 'rgba(255,255,255,0.2)' }}
                      onClick={() => removeEdge(edge.id)}
                      title="Remove this connection"
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })}
          </div>
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* CONFIGURATION — Core */}
      {/* ═══════════════════════════════════════════════════ */}
      <Section title="Configuration" defaultOpen>
        {/* Tier Selection */}
        <div className="form-group">
          <label className="form-label">Tier / Size</label>
          <select
            className="form-select"
            value={node.data.tierIndex}
            onChange={e => handleTierChange(Number(e.target.value))}
          >
            {def.tiers.map((tier, i) => (
              <option key={tier.id} value={i}>
                {tier.label} — ${tier.monthlyCost}/mo
              </option>
            ))}
          </select>
        </div>

        {/* Instance Count */}
        {node.data.scalingType === 'horizontal' && (
          <div className="form-group">
            <label className="form-label">Instances</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" className="form-range" min={1} max={20}
                value={node.data.instances}
                onChange={e => handleInstanceChange(Number(e.target.value))}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 24, color: 'var(--text-primary)' }}>
                {node.data.instances}
              </span>
            </div>
          </div>
        )}

        {/* Pricing Model */}
        {(isCompute || isDB || isCache) && (
          <div className="form-group">
            <label className="form-label">Pricing Model</label>
            <select className="form-select" value={data.pricingModel || 'on-demand'}
              onChange={e => update('pricingModel', e.target.value)}
            >
              <option value="on-demand">On-Demand (Hourly)</option>
              <option value="savings-1yr">1-Year Savings Plan (-30%)</option>
              <option value="reserved-3yr">3-Year Reserved (-50%)</option>
              {isCompute && <option value="spot">Spot Instances (-70%)</option>}
            </select>
          </div>
        )}

        {/* Region */}
        <div className="form-group">
          <label className="form-label">Region / AZ</label>
          <select className="form-select" value={data.region || regions[0]}
            onChange={e => update('region', e.target.value)}
          >
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Enable / Disable */}
        <div className="form-group">
          <label className="form-label">Status</label>
          <button
            className="btn"
            style={{
              width: '100%', justifyContent: 'center',
              color: node.data.isDisabled ? 'var(--danger)' : 'var(--success)',
              borderColor: node.data.isDisabled ? 'var(--danger-muted)' : 'var(--success-muted)',
              background: node.data.isDisabled ? 'var(--danger-muted)' : 'var(--success-muted)',
            }}
            onClick={() => update('isDisabled', !node.data.isDisabled)}
          >
            {node.data.isDisabled ? <PowerOff size={14} /> : <Power size={14} />}
            {node.data.isDisabled ? 'Disabled — Click to Enable' : 'Enabled — Click to Disable'}
          </button>
        </div>
      </Section>

      {/* Server & Compute Advanced Settings */}
      {isCompute && (
        <Section title="Compute Details" defaultOpen={false}>
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
        </Section>
      )}

      {/* Auth Configuration */}
      {isAuth && (
        <Section title="Authentication Settings" defaultOpen>
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
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* SCALING — Auto-scaling config */}
      {/* ═══════════════════════════════════════════════════ */}
      {node.data.scalingType === 'horizontal' && (
        <Section title="Auto-Scaling" defaultOpen={false}>
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
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* DATABASE-SPECIFIC */}
      {/* ═══════════════════════════════════════════════════ */}
      {isDB && (
        <Section title="Database Settings" defaultOpen={false}>
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
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* CACHE-SPECIFIC */}
      {/* ═══════════════════════════════════════════════════ */}
      {isCache && (
        <Section title="Cache Settings" defaultOpen>
          <div className="form-group">
            <label className="form-label">Cache Hit Rate</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" className="form-range" min={0} max={100}
                value={(node.data.cacheHitRate ?? 0.6) * 100}
                onChange={e => handleCacheRateChange(Number(e.target.value) / 100)}
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
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* LOAD BALANCER SPECIFIC */}
      {/* ═══════════════════════════════════════════════════ */}
      {isLB && (
        <Section title="Load Balancer Settings" defaultOpen>
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
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* COMPUTE-SPECIFIC */}
      {/* ═══════════════════════════════════════════════════ */}
      {isCompute && (
        <Section title="Server Settings" defaultOpen={false}>
          <div className="form-group">
            <label className="form-label">Request Timeout (ms)</label>
            <input type="number" className="form-input" min={100} max={300000} step={100}
              value={data.requestTimeout || 30000}
              onChange={e => update('requestTimeout', Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Max Concurrent Requests</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" className="form-range" min={10} max={10000} step={10}
                value={data.maxConcurrentRequests || 1000}
                onChange={e => update('maxConcurrentRequests', Number(e.target.value))}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', minWidth: 44, color: 'var(--text-primary)' }}>
                {data.maxConcurrentRequests || 1000}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Graceful Shutdown (seconds)</label>
            <input type="number" className="form-input" min={0} max={120}
              value={data.gracefulShutdown || 30}
              onChange={e => update('gracefulShutdown', Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Log Level</label>
            <select className="form-select" value={data.logLevel || 'info'}
              onChange={e => update('logLevel', e.target.value)}
            >
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Environment</label>
            <select className="form-select" value={data.environment || 'production'}
              onChange={e => update('environment', e.target.value)}
            >
              <option value="development">development</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
          </div>
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* MESSAGING-SPECIFIC */}
      {/* ═══════════════════════════════════════════════════ */}
      {isMessaging && (
        <Section title="Queue / Messaging Settings" defaultOpen={false}>
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
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* NETWORK — CDN/Gateway specific */}
      {/* ═══════════════════════════════════════════════════ */}
      {isNetwork && !isLB && (
        <Section title="Network Settings" defaultOpen={false}>
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
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* RELIABILITY & RESILIENCE — Universal */}
      {/* ═══════════════════════════════════════════════════ */}
      <Section title="Reliability & Resilience" defaultOpen={false}>
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
      </Section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* PERFORMANCE — Live stats */}
      {/* ═══════════════════════════════════════════════════ */}
      <Section title="Live Performance" defaultOpen>
        <div className="stat-row">
          <span className="stat-label">Capacity</span>
          <span className="stat-value">
            {(node.data.tier.capacity * node.data.instances).toLocaleString()} rps
          </span>
        </div>

        <div className="stat-row">
          <span className="stat-label">Base Latency</span>
          <span className="stat-value">{node.data.tier.latency}ms</span>
        </div>

        <div className="stat-row">
          <span className="stat-label">Reliability</span>
          <span className="stat-value">{(node.data.reliability * 100).toFixed(1)}%</span>
        </div>

        <div className="stat-row">
          <span className="stat-label">Current Load</span>
          <span
            className="stat-value"
            style={{
              color: health?.status === 'critical'
                ? 'var(--danger)'
                : health?.status === 'warning'
                  ? 'var(--warning)'
                  : 'var(--success)',
            }}
          >
            {health?.loadPercent ?? 0}%
          </span>
        </div>

        <div style={{ marginTop: 8 }}>
          <div className="load-bar">
            <div
              className={`load-bar-fill ${health?.status || 'healthy'}`}
              style={{ width: `${Math.min(100, health?.loadPercent ?? 0)}%` }}
            />
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* COST */}
      {/* ═══════════════════════════════════════════════════ */}
      <Section title="Cost Breakdown" defaultOpen>
        <div className="stat-row">
          <span className="stat-label" style={{ fontWeight: 600 }}>Total Monthly Cost</span>
          <span className="stat-value cost">{formatCostFull(cost)}</span>
        </div>
        {node.data.tier.cpu && (
          <div className="stat-row">
            <span className="stat-label">CPU</span>
            <span className="stat-value">{node.data.tier.cpu}</span>
          </div>
        )}
        {node.data.tier.ram && (
          <div className="stat-row">
            <span className="stat-label">RAM</span>
            <span className="stat-value">{node.data.tier.ram}</span>
          </div>
        )}
        {isDB && data.readReplicas > 0 && (
          <div className="stat-row">
            <span className="stat-label">Read Replicas Cost</span>
            <span className="stat-value cost">
              +{formatCostFull(node.data.tier.monthlyCost * (data.readReplicas || 0) * 0.7)}
            </span>
          </div>
        )}
        {data.multiAZ && (
          <div className="stat-row">
            <span className="stat-label">Multi-AZ Premium</span>
            <span className="stat-value cost">+{formatCostFull(cost * 0.5)}</span>
          </div>
        )}
      </Section>

      {/* ── Actions ── */}
      <div className="right-panel-section" style={{ borderBottom: 'none', display: 'flex', gap: '8px', paddingTop: 16, paddingBottom: 20 }}>
        <button
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s ease',
            fontFamily: 'var(--font-sans)',
          }}
          onClick={handleDuplicate}
          title="Duplicate Component"
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
        >
          <Copy size={13} />
          Clone
        </button>
        <button
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 12px', borderRadius: 8,
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
            color: '#f87171', fontSize: '0.75rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s ease',
            fontFamily: 'var(--font-sans)',
          }}
          onClick={() => { removeNode(node.id); selectNode(null); }}
          title="Remove Component"
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'; }}
        >
          <Trash2 size={13} />
          Remove
        </button>
      </div>
    </div>
  );
}
