import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { X } from 'lucide-react';
import { getComponentCost, formatCost } from '../../engine/costEngine';
import { useArchStore } from '../../store/useArchStore';
import { calculateCarbonFootprints, getCarbonHeatmapColor, getCarbonBorderColor } from '../../engine/carbonEngine';
import type { ArchNodeData } from '../../types';

// Dynamic icon resolver
function getIcon(name: string): React.ComponentType<{ size?: number; className?: string }> {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
    return icon as React.ComponentType<{ size?: number; className?: string }>;
  }
  return Icons.Box;
}

function ArchNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as ArchNodeData;
  const IconComponent = getIcon(d.icon);
  const greenOpsHeatmap = useArchStore(s => s.greenOpsHeatmap);
  const nodes = useArchStore(s => s.nodes);
  
  const healthClass = d.isFailed ? 'failed' : d.isDisabled ? 'disabled' : d.healthStatus;
  const selectedClass = selected ? 'selected' : '';
  const overloadedClass = d.loadPercent > 80 && !d.isFailed ? 'node-overloaded' : '';
  
  // Calculate cost for display
  const mockNode = { data: d, id, type: 'archNode', position: { x: 0, y: 0 } };
  const cost = getComponentCost(mockNode as never);
  
  // GreenOps heatmap coloring
  let heatmapStyle: React.CSSProperties = {};
  let carbonBadge: React.ReactNode = null;
  
  if (greenOpsHeatmap && !d.isFailed && !d.isDisabled) {
    const footprints = calculateCarbonFootprints(nodes);
    const fp = footprints.find(f => f.nodeId === id);
    if (fp) {
      heatmapStyle = {
        background: getCarbonHeatmapColor(fp.rating),
        boxShadow: `0 0 12px ${getCarbonBorderColor(fp.rating)}20, inset 0 0 0 1px ${getCarbonBorderColor(fp.rating)}30`,
      };
      carbonBadge = (
        <div className="arch-node-carbon-badge" style={{ 
          color: getCarbonBorderColor(fp.rating),
          background: getCarbonHeatmapColor(fp.rating),
          border: `1px solid ${getCarbonBorderColor(fp.rating)}40`,
        }}>
          {fp.monthlyCO2kg < 1 ? `${Math.round(fp.monthlyCO2kg * 1000)}g` : `${fp.monthlyCO2kg.toFixed(1)}kg`} CO₂
        </div>
      );
    }
  }
  
  // Deployment version badge
  const versionBadge = d.appVersion ? (
    <div className={`arch-node-version-badge ${d.appVersion === 'v1' ? 'blue' : 'green'}`}>
      {d.appVersion === 'v1' ? 'BLUE' : 'GREEN'}
    </div>
  ) : null;
  
  return (
    <div 
      className={`arch-node ${healthClass} ${selectedClass} ${overloadedClass}`}
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
