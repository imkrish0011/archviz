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
  const trafficWeight = config.trafficWeight;
  
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
  
  // Dim the edge based on traffic weight during deployments
  if (trafficWeight !== undefined && trafficWeight !== null) {
    edgeStyle.opacity = Math.max(0.15, trafficWeight / 100);
    if (trafficWeight === 0) {
      edgeStyle.strokeDasharray = '3 6';
    }
  }

  const label = config.edgeLabel;
  
  // Traffic weight badge color
  const weightColor = trafficWeight !== undefined && trafficWeight !== null
    ? (trafficWeight >= 50 ? '#10b981' : trafficWeight > 0 ? '#3b82f6' : '#666')
    : null;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={edgeStyle}
        className={className}
        id={id}
      />
      {(label || (trafficWeight !== undefined && trafficWeight !== null)) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: weightColor ? `${weightColor}18` : 'var(--bg-surface)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              color: weightColor || 'var(--text-secondary)',
              pointerEvents: 'all',
              border: `1px solid ${weightColor ? `${weightColor}40` : 'var(--border-subtle)'}`,
            }}
            className="nodrag nopan"
          >
            {label || `${trafficWeight}%`}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
