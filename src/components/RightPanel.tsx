import { useArchStore } from '../store/useArchStore';
import { getComponentDefinition, getAllCategories, getCategoryLabel } from '../data/componentLibrary';
import componentLibrary from '../data/componentLibrary';
import { getComponentCost, formatCostFull } from '../engine/costEngine';
import { useSimulation } from '../hooks/useSimulation';
import { X, Trash2, Info, Copy, RefreshCw, Power, PowerOff, GitBranch } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { ArchNode } from '../types';

import EdgeConfigPanel from './panels/EdgeConfigPanel';
import ComputeConfigPanel from './panels/ComputeConfigPanel';
import AuthConfigPanel from './panels/AuthConfigPanel';
import DatabaseConfigPanel from './panels/DatabaseConfigPanel';
import ScalingConfigPanel from './panels/ScalingConfigPanel';
import { StorageConfigPanel, CacheConfigPanel, LBConfigPanel, NetworkConfigPanel, MessagingConfigPanel, ReliabilityConfigPanel } from './panels/MiscPanels';
import LambdaConfigPanel from './panels/LambdaConfigPanel';
import S3ConfigPanel from './panels/S3ConfigPanel';
import KafkaConfigPanel from './panels/KafkaConfigPanel';
import ApiGatewayConfigPanel from './panels/ApiGatewayConfigPanel';
import KubernetesConfigPanel from './panels/KubernetesConfigPanel';
import PanelSection from './panels/PanelSection';

/* ── Helpers ── */
const dbTypes = ['postgresql', 'mysql', 'mongodb', 'cassandra', 'dynamodb', 'aurora-serverless', 'bigtable', 'pinecone', 'elasticsearch', 'snowflake', 'rds-proxy', 'rds-postgres', 'neo4j', 'influxdb', 'amazon-efs', 'amazon-glacier', 'qdrant', 'data-lake', 'block-storage', 'feature-store', 'clickhouse', 'supabase', 'cockroachdb', 'databricks-lakehouse', 'serverless-db', 'databricks', 'snowflake-dwh', 'planetscale'];
const cacheTypes = ['redis', 'memcached', 'elasticache-redis'];
const computeTypes = ['api-server', 'web-server', 'websocket-server', 'worker', 'graphql-server', 'game-server', 'lambda', 'ecs-fargate', 'app-runner', 'batch', 'ml-worker', 'kubernetes-cluster', 'cloudflare-workers', 'eks-cluster', 'ecs-container', 'aws-batch', 'apache-spark', 'gpu-instance', 'docker-container', 'aws-sagemaker', 'vertex-ai', 'huggingface', 'vllm-server', 'temporal-worker', 'vercel', 'netlify', 'cloudflare-pages', 'nextjs', 'react', 'vue'];
const networkTypes = ['load-balancer', 'cdn', 'api-gateway', 'dns', 'waf', 'nat-gateway', 'aws-waf', 'transit-gateway', 'alb', 'vpc-endpoint', 'fastly-cdn', 'cloudflare-zero-trust', 'service-mesh', 'istio-mesh', 'reverse-proxy', 'vpn-gateway', 'aws-transit-gateway'];
const messagingTypes = ['sqs', 'sns', 'kafka', 'message-queue', 'eventbridge', 'kinesis', 'step-functions', 'rabbitmq', 'amazon-sqs', 'apache-kafka', 'amazon-eventbridge', 'amazon-kinesis', 'webhook-handler', 'mqtt-broker', 'webrtc-sfu', 'confluent-kafka', 'temporal'];

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
  const startDeployment = useArchStore(s => s.startDeployment);
  const deploymentState = useArchStore(s => s.deploymentState);
  const { nodeHealth } = useSimulation();

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
  const isLB = node.data.componentType === 'load-balancer' || node.data.componentType === 'alb';
  const isAuth = ['auth0', 'aws-cognito', 'active-directory', 'hashicorp-vault', 'aws-iam', 'entra-id', 'okta'].includes(node.data.componentType);

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
    updateNodeData(node.id, { [key]: value } as Partial<import('../types').ArchNodeData>);
  };

  const handleDuplicate = () => {
    const { generateNodeId } = require('../utils/idGenerator');
    const newNodeId = generateNodeId();
    const newNode = {
      ...node,
      id: newNodeId,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
    };
    useArchStore.getState().setNodes([...nodes, newNode]);
    useArchStore.getState().takeSnapshot('Duplicated component');
    selectNode(newNodeId);
  };

  const data = node.data as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const catColor = `var(--cat-${def.category})`;
  const catMuted = `var(--cat-${def.category}-muted)`;

  const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
  const healthColor = health?.status === 'critical' ? '#f87171' : health?.status === 'warning' ? '#fbbf24' : '#34d399';
  const healthLabel = health?.status === 'critical' ? 'Critical' : health?.status === 'warning' ? 'Warning' : 'Healthy';

  return (
    <div className="right-panel">
      {/* ── Premium Header ── */}
      <div 
        className="right-panel-header"
        style={{ 
          backgroundColor: '#0c0b0f',
          backgroundImage: `linear-gradient(180deg, var(--cat-${def.category}-subtle) 0%, transparent 100%)`,
          padding: '16px 20px',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '4px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>Inspector</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            {/* Category icon glow */}
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: catMuted,
              border: `1px solid ${catColor}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 12px ${catColor}15`,
            }}>
              {(() => {
                const IconComp = (Icons as unknown as Record<string, import('react').ElementType>)[def.icon] || Icons.Box;
                return <IconComp size={16} style={{ color: catColor }} />;
              })()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                value={node.data.label}
                onChange={e => updateNodeData(node.id, { label: e.target.value })}
                style={{
                  background: 'transparent', border: 'none', borderBottom: '1px solid transparent',
                  color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 650, width: '100%',
                  outline: 'none', padding: '0', letterSpacing: '-0.01em',
                  fontFamily: 'var(--font-sans)',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden'
                }}
                onFocus={e => (e.target.style.borderBottom = `1px solid ${catColor}`)}
                onBlur={e => (e.target.style.borderBottom = '1px solid transparent')}
              />
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: 2, letterSpacing: '0.04em', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {def.category.toUpperCase()} · {def.type}
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={() => selectNode(null)} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
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

      {/* CHANGE COMPONENT TYPE */}
      <PanelSection title="Change Component" defaultOpen={false}>
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
      </PanelSection>

      {/* CONNECTIONS — Edge Management */}
      {connectedEdges.length > 0 && (
        <PanelSection title={`Connections (${connectedEdges.length})`} defaultOpen={false}>
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
        </PanelSection>
      )}

      {/* CONFIGURATION — Core */}
      <PanelSection title="Configuration" defaultOpen>
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

        <div className="form-group">
          <label className="form-label">Region / AZ</label>
          <select className="form-select" value={data.region || regions[0]}
            onChange={e => update('region', e.target.value)}
          >
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

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
      </PanelSection>

      {/* ── Bespoke Component-Specific Panels ── */}
      {node.data.componentType === 'lambda' && <LambdaConfigPanel data={data} update={update} />}
      {node.data.componentType === 's3' && <S3ConfigPanel data={data} update={update} />}
      {(node.data.componentType === 'kafka' || node.data.componentType === 'confluent-kafka' || node.data.componentType === 'apache-kafka') && <KafkaConfigPanel data={data} update={update} />}
      {node.data.componentType === 'api-gateway' && <ApiGatewayConfigPanel data={data} update={update} />}
      {(node.data.componentType === 'kubernetes-cluster' || node.data.componentType === 'eks-cluster') && <KubernetesConfigPanel data={data} update={update} />}

      {/* ── Category-Based Modular Panels ── */}
      {isCompute && node.data.componentType !== 'lambda' && <ComputeConfigPanel data={data} update={update} />}
      {isAuth && <AuthConfigPanel data={data} update={update} />}
      {node.data.scalingType === 'horizontal' && <ScalingConfigPanel node={node} data={data} update={update} />}
      {isDB && <DatabaseConfigPanel data={data} update={update} />}
      {isDB && <StorageConfigPanel node={node} data={data} update={update} />}
      {isCache && <CacheConfigPanel node={node} data={data} update={update} handleCacheRateChange={handleCacheRateChange} />}
      {isLB && <LBConfigPanel node={node} data={data} update={update} />}
      {isNetwork && !isLB && node.data.componentType !== 'api-gateway' && <NetworkConfigPanel node={node} data={data} update={update} />}
      {isMessaging && node.data.componentType !== 'kafka' && node.data.componentType !== 'confluent-kafka' && node.data.componentType !== 'apache-kafka' && <MessagingConfigPanel node={node} data={data} update={update} />}
      
      <ReliabilityConfigPanel node={node} data={data} update={update} />

      {/* PERFORMANCE — Live stats */}
      <PanelSection title="Live Performance" defaultOpen>
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
      </PanelSection>

      {/* COST */}
      <PanelSection title="Cost Breakdown" defaultOpen>
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
      </PanelSection>

      {/* ENTERPRISE SIMULATIONS */}
      {(isCompute || node.type === 'groupNode') && (
        <PanelSection title="Live Deployment Visualizer" defaultOpen>
          <div className="form-group" style={{ marginTop: 4 }}>
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, margin: '0 0 10px 0' }}>
              Simulate a Blue/Green or Canary deployment. Traffic will seamlessly shift from v1 to v2 over a 10s window.
            </p>
            <button
              className="btn"
              style={{
                width: '100%', justifyContent: 'center',
                background: deploymentState.isActive ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.1)',
                color: deploymentState.isActive ? 'var(--text-disabled)' : '#818cf8',
                borderColor: deploymentState.isActive ? 'var(--border-default)' : 'rgba(99,102,241,0.25)',
                pointerEvents: deploymentState.isActive ? 'none' : 'auto',
                fontWeight: 600,
              }}
              onClick={() => startDeployment(node.id)}
            >
              <GitBranch size={14} />
              {deploymentState.isActive ? 'Deployment In Progress...' : 'Launch Blue/Green Deployment'}
            </button>
          </div>
        </PanelSection>
      )}

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
