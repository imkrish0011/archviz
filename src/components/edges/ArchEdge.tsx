import type { EdgeProps } from '@xyflow/react';
import { getSmoothStepPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
import type { EdgeConfig } from '../../types';

interface ArchEdgeData {
  config?: EdgeConfig;
  [key: string]: unknown;
}

export default function ArchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as ArchEdgeData | undefined;
  const config = edgeData?.config || {};
  const connectionType = config.connectionType || 'default';
  
  // Base styling
  const edgeStyle = { ...style };
  let className = 'react-flow__edge-path';
  
  switch(connectionType) {
    case 'sync-http':
      edgeStyle.strokeWidth = 3;
      edgeStyle.strokeDasharray = 'none';
      break;
    case 'async-event':
      edgeStyle.strokeDasharray = '5 5';
      className += ' async-event-edge';
      break;
    case 'firewall-boundary':
      edgeStyle.stroke = '#ef4444'; // Red
      edgeStyle.strokeWidth = 2;
      edgeStyle.strokeDasharray = '2 4';
      edgeStyle.strokeLinecap = 'round';
      break;
    default:
      break;
  }

  // Preserve external classNames (like edge-healthy from simulation) passed via the container,
  // but we apply our own classes to the path directly here for specific animations.

  const label = config.edgeLabel;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={edgeStyle}
        className={className}
        id={id}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: 'var(--bg-surface)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              pointerEvents: 'all',
              border: '1px solid var(--border-subtle)',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
