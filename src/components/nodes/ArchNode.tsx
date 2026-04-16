import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { X } from 'lucide-react';
import { getComponentCost, formatCost } from '../../engine/costEngine';
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
  
  const healthClass = d.isFailed ? 'failed' : d.isDisabled ? 'disabled' : d.healthStatus;
  const selectedClass = selected ? 'selected' : '';
  const overloadedClass = d.loadPercent > 80 && !d.isFailed ? 'node-overloaded' : '';
  
  // Calculate cost for display
  const mockNode = { data: d, id, type: 'archNode', position: { x: 0, y: 0 } };
  const cost = getComponentCost(mockNode as never);
  
  return (
    <div 
      className={`arch-node ${healthClass} ${selectedClass} ${overloadedClass}`}
      data-category={d.category}
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
