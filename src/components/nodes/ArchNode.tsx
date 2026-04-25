import { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { X } from 'lucide-react';
import { getComponentCost, formatCost } from '../../engine/costEngine';
import { getCarbonHeatmapColor, getCarbonBorderColor } from '../../engine/carbonEngine';
import { useArchStore } from '../../store/useArchStore';
import type { ArchNodeData } from '../../types';

// Dynamic icon resolver — stable reference via memoization in component
function getIcon(name: string): React.ComponentType<{ size?: number; className?: string }> {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
    return icon as React.ComponentType<{ size?: number; className?: string }>;
  }
  return Icons.Box;
}

/**
 * ArchNode — the primary canvas node component.
 * 
 * Performance notes:
 * - Wrapped in React.memo to prevent re-renders from parent (React Flow)
 * - No subscription to full `nodes` array (carbon/security computed externally)
 * - Replaced framer-motion layout with CSS animation for 10x drag perf
 * - Cost computed via useMemo to avoid recalculation on each render
 */
function ArchNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as ArchNodeData;
  const IconComponent = getIcon(d.icon);
  
  // Fine-grained selectors — only re-render when these specific values change
  const greenOpsHeatmap = useArchStore(s => s.greenOpsHeatmap);
  const computedSecurityReport = useArchStore(s => s.computedSecurityReport);

  // Carbon data is passed via node data from parent instead of subscribing to all nodes
  // This eliminates the N² re-render problem where each node subscribes to the full nodes array
  const carbonData = d.carbonFootprint as { monthlyCO2kg: number; rating: string } | undefined;
  const carbonRating = carbonData?.rating as 'low' | 'medium' | 'high' | undefined;
  
  const healthClass = d.isFailed ? 'failed' : d.isDisabled ? 'disabled' : d.healthStatus;
  const selectedClass = selected ? 'selected' : '';
  const overloadedClass = d.loadPercent > 80 && !d.isFailed ? 'node-overloaded' : '';
  const isBottlenecked = d.loadPercent >= 100 && !d.isFailed;
  const bottleneckClass = isBottlenecked ? 'node-bottlenecked' : '';
  
  // Calculate cost (memoized)
  const cost = useMemo(() => {
    const mockNode = { data: d, id, type: 'archNode', position: { x: 0, y: 0 } };
    return getComponentCost(mockNode as never);
  }, [d, id]);
  
  // GreenOps heatmap coloring (computed from passed-in carbon data, not full nodes array)
  const heatmapStyle = useMemo<React.CSSProperties>(() => {
    if (!greenOpsHeatmap || d.isFailed || d.isDisabled || !carbonRating) return {};
    
    return {
      background: getCarbonHeatmapColor(carbonRating),
      boxShadow: `0 0 12px ${getCarbonBorderColor(carbonRating)}20, inset 0 0 0 1px ${getCarbonBorderColor(carbonRating)}30`,
    };
  }, [greenOpsHeatmap, d.isFailed, d.isDisabled, carbonRating]);

  // Carbon badge
  const carbonBadge = useMemo(() => {
    if (!greenOpsHeatmap || d.isFailed || d.isDisabled || !carbonData || !carbonRating) return null;
    return (
      <div className="arch-node-carbon-badge" style={{ 
        color: getCarbonBorderColor(carbonRating),
        background: getCarbonHeatmapColor(carbonRating),
        border: `1px solid ${getCarbonBorderColor(carbonRating)}40`,
      }}>
        {carbonData.monthlyCO2kg < 1 ? `${Math.round(carbonData.monthlyCO2kg * 1000)}g` : `${carbonData.monthlyCO2kg.toFixed(1)}kg`} CO₂
      </div>
    );
  }, [greenOpsHeatmap, d.isFailed, d.isDisabled, carbonData]);
  
  // Security Vulnerability Badge
  const securityBadge = useMemo(() => {
    if (!computedSecurityReport || d.isFailed || d.isDisabled) return null;
    const findings = computedSecurityReport.findings.filter((f) => f.affectedNodeIds.includes(id));
    if (findings.length === 0) return null;
    
    const hasCritical = findings.some((f) => f.severity === 'critical');
    const hasHigh = findings.some((f) => f.severity === 'high');
    const color = hasCritical ? '#ff4444' : hasHigh ? '#ff8c00' : '#fbbf24';
    return (
      <div className="arch-node-security-badge-container" onClick={(e) => {
        e.stopPropagation();
        useArchStore.getState().selectNode(id);
        useArchStore.setState({ securityPanelOpen: true });
      }}>
        <div className="arch-node-security-badge" style={{ border: `1px solid ${color}` }} title={`${findings.length} security finding(s). Click to view details.`}>
          <Icons.ShieldAlert size={16} color={color} />
        </div>
      </div>
    );
  }, [computedSecurityReport, d.isFailed, d.isDisabled, id]);
  
  // Deployment version badge
  const versionBadge = d.appVersion ? (
    <div className={`arch-node-version-badge ${d.appVersion === 'v1' ? 'blue' : 'green'}`}>
      {d.appVersion === 'v1' ? 'BLUE' : 'GREEN'}
    </div>
  ) : null;
  
  const bottleneckBadge = isBottlenecked ? (
    <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 z-10 shadow-lg" title="Capacity Exceeded">
      <Icons.AlertTriangle size={12} strokeWidth={3} />
    </div>
  ) : null;

  return (
    <div 
      className={`arch-node arch-node-enter ${healthClass} ${selectedClass} ${overloadedClass} ${bottleneckClass}`}
      data-category={d.category}
      style={heatmapStyle}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      
      {d.isFailed && (
        <div className="arch-node-failed-overlay">
          <X size={24} />
        </div>
      )}
      
      {d.instances > 1 && (
        <div className="arch-node-instances">{d.instances}x</div>
      )}
      
      {versionBadge}
      {carbonBadge}
      {securityBadge}
      {bottleneckBadge}
      
      <div className="arch-node-header">
        <IconComponent size={18} className="arch-node-icon" />
        <span className="arch-node-label">{d.label}</span>
      </div>
      
      <div className="arch-node-meta">
        <span className="arch-node-tier">{d.tier.label}</span>
        <span className="arch-node-cost">{formatCost(cost)}</span>
      </div>
      
      <div className="arch-node-load-bar">
        <div 
          className={`arch-node-load-fill ${d.healthStatus}`}
          style={{ width: `${Math.min(100, d.loadPercent)}%` }}
        />
      </div>
    </div>
  );
}

export default memo(ArchNodeComponent);
