import React, { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ArchNodeData } from '../../types';

export const ZoneNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as ArchNodeData;

  // We assign a specific translucent color based on the boundary type.
  let zoneColor = 'rgba(148, 163, 184, 0.05)'; // default slate
  let borderColor = '#475569';
  if (nodeData.label.toLowerCase().includes('vpc')) {
    zoneColor = 'rgba(14, 165, 233, 0.03)'; // subtle sky blue
    borderColor = '#0ea5e9';
  } else if (nodeData.label.toLowerCase().includes('public subnet')) {
    zoneColor = 'rgba(34, 197, 94, 0.03)'; // subtle green
    borderColor = '#22c55e';
  } else if (nodeData.label.toLowerCase().includes('private subnet')) {
    zoneColor = 'rgba(239, 68, 68, 0.03)'; // subtle red
    borderColor = '#ef4444';
  } else if (nodeData.label.toLowerCase().includes('region')) {
    zoneColor = 'rgba(245, 158, 11, 0.03)'; // subtle orange
    borderColor = '#f59e0b';
  } else if (nodeData.label.toLowerCase().includes('on-premises')) {
    zoneColor = 'rgba(120, 113, 108, 0.06)'; // subtle stone
    borderColor = '#78716c';
  }

  return (
    <>
      <NodeResizer 
        color="#818cf8" 
        isVisible={selected} 
        minWidth={200} 
        minHeight={150} 
      />
      <div
        className="zone-node-container"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: zoneColor,
          border: `1px dashed ${borderColor}`,
          borderRadius: '8px',
          position: 'relative',
          opacity: nodeData.isDisabled ? 0.4 : 1,
          transition: 'all 0.3s ease',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '6px 12px',
          backgroundColor: 'rgba(0,0,0,0.2)',
          borderBottom: `1px solid ${borderColor}`,
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backdropFilter: 'blur(4px)'
        }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: borderColor, fontWeight: 700 }}>
            {nodeData.label}
          </span>
        </div>
        
        {/* Optional empty target handles so edges can technically connect to the zone if needed */}
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
        <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      </div>
    </>
  );
});

ZoneNode.displayName = 'ZoneNode';
