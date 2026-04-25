import { memo, useMemo } from 'react';
import type { EdgeProps } from '@xyflow/react';
import { getSmoothStepPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
import type { EdgeConfig } from '../../types';
import { useArchStore } from '../../store/useArchStore';
import { useSimulation } from '../../hooks/useSimulation';

interface ArchEdgeData {
  config?: EdgeConfig;
  [key: string]: unknown;
}

/**
 * Deterministic animation duration from edge ID — replaces Math.random() in render.
 * Uses a simple hash of the ID string to produce a value between 1.2 and 2.8.
 */
function stableAnimDuration(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return 1.2 + (Math.abs(hash) % 160) / 100;
}

function ArchEdgeComponent({
  id,
  source,
  target,
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

  const isTracing = useArchStore(s => s.isTracing);
  const { nodeHealth } = useSimulation();

  const sourceHealth = nodeHealth.get(source);
  const targetHealth = nodeHealth.get(target);
  const isBottleneck = (sourceHealth && sourceHealth.loadPercent > 80) || (targetHealth && targetHealth.loadPercent > 80);

  const edgeData = data as ArchEdgeData | undefined;
  const config = edgeData?.config || {};
  const connectionType = config.connectionType || 'default';
  const trafficWeight = config.trafficWeight;
  
  // Stable animation duration derived from edge ID (no Math.random)
  const animDuration = useMemo(() => stableAnimDuration(id), [id]);

  // Memoize style computation
  const { edgeStyle, className } = useMemo(() => {
    const computedStyle = { ...style };
    let cls = 'react-flow__edge-path';
    
    if (isBottleneck) {
      computedStyle.stroke = '#ff4500';
      computedStyle.filter = 'drop-shadow(0 0 5px rgba(255, 69, 0, 0.8))';
      cls += ' bottleneck-glow';
    }

    switch(connectionType) {
      case 'sync-http':
        computedStyle.strokeWidth = 3;
        computedStyle.strokeDasharray = 'none';
        break;
      case 'async-event':
        computedStyle.strokeDasharray = '5 5';
        cls += ' async-event-edge';
        break;
      case 'firewall-boundary':
        computedStyle.stroke = '#ef4444';
        computedStyle.strokeWidth = 2;
        computedStyle.strokeDasharray = '2 4';
        computedStyle.strokeLinecap = 'round';
        break;
      default:
        break;
    }
    
    // Dim the edge based on traffic weight during deployments
    if (trafficWeight !== undefined && trafficWeight !== null) {
      computedStyle.opacity = Math.max(0.15, trafficWeight / 100);
      if (trafficWeight === 0) {
        computedStyle.strokeDasharray = '3 6';
      }
    }

    return { edgeStyle: computedStyle, className: cls };
  }, [style, isBottleneck, connectionType, trafficWeight]);

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

      {/* ── Animated Data Flow Tracer ── */}
      {isTracing && (
        <g>
          {/* Outer glow particle */}
          <circle r="6" fill="none" stroke="#5eead4" strokeWidth="2" opacity="0.3" filter="url(#tracer-glow)">
            <animateMotion dur={`${animDuration}s`} repeatCount="indefinite" path={edgePath} />
          </circle>
          {/* Core bright particle */}
          <circle r="3.5" fill="#5eead4" opacity="0.95">
            <animateMotion dur={`${animDuration}s`} repeatCount="indefinite" path={edgePath} />
          </circle>
          {/* Inner hot core */}
          <circle r="1.5" fill="#ffffff" opacity="0.9">
            <animateMotion dur={`${animDuration}s`} repeatCount="indefinite" path={edgePath} />
          </circle>
        </g>
      )}

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

export default memo(ArchEdgeComponent);
