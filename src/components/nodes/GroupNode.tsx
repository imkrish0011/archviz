import { memo } from 'react';
import { NodeResizer, Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

const groupColors: Record<string, { border: string; bg: string; label: string }> = {
  vpc:              { border: '#a78bfa', bg: 'rgba(167, 139, 250, 0.04)', label: 'VPC' },
  'subnet-public':  { border: '#34d399', bg: 'rgba(52, 211, 153, 0.04)', label: 'Public Subnet' },
  'subnet-private': { border: '#fb923c', bg: 'rgba(251, 146, 60, 0.04)', label: 'Private Subnet' },
  'availability-zone': { border: '#60a5fa', bg: 'rgba(96, 165, 250, 0.04)', label: 'Availability Zone' },
  'on-premises':       { border: '#9ca3af', bg: 'rgba(156, 163, 175, 0.04)', label: 'On-Premises' },
};

function GroupNode({ data, selected }: NodeProps) {
  const d = data as unknown as Record<string, unknown>;
  const groupType = d.componentType || 'vpc';
  const colors = groupColors[groupType] || groupColors.vpc;
  const label = d.label || colors.label;

  return (
    <>
      <NodeResizer
        minWidth={220}
        minHeight={160}
        isVisible={selected}
        lineClassName="group-node-resizer-line"
        handleClassName="group-node-resizer-handle"
        color={colors.border}
      />
      <div
        className="group-node"
        style={{
          borderColor: selected ? colors.border : `${colors.border}66`,
          backgroundColor: colors.bg,
          width: '100%',
          height: '100%',
        }}
      >
        <div className="group-node-label" style={{ color: colors.border }}>
          <span className="group-node-badge" style={{ background: `${colors.border}20`, border: `1px solid ${colors.border}40` }}>
            {colors.label}
          </span>
          <span className="group-node-name">{label}</span>
        </div>
      </div>
      {/* Connection handles */}
      <Handle type="target" position={Position.Left} className="group-node-handle" />
      <Handle type="source" position={Position.Right} className="group-node-handle" />
    </>
  );
}

export default memo(GroupNode);
