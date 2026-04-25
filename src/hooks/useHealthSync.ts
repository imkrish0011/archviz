import { useEffect, useRef } from 'react';
import { useArchStore } from '../store/useArchStore';
import { useSimulation } from './useSimulation';

/**
 * Extracted health synchronization hook.
 * Debounces simulation health updates to prevent render storms
 * and batches node/edge updates together.
 */
export function useHealthSync() {
  const { nodeHealth } = useSimulation();
  const rafRef = useRef<number | null>(null);
  const lastHealthRef = useRef<Map<string, { loadPercent: number; status: string }>>(new Map());

  useEffect(() => {
    // Cancel any pending frame
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    // Use requestAnimationFrame to batch updates
    rafRef.current = requestAnimationFrame(() => {
      const { nodes, edges, updateNodeData, setEdges } = useArchStore.getState();

      // 1. Update node health data (only if changed)
      let hasNodeChanges = false;
      for (const node of nodes) {
        const health = nodeHealth.get(node.id);
        const prevHealth = lastHealthRef.current.get(node.id);

        if (
          health &&
          (node.data.loadPercent !== health.loadPercent ||
            node.data.healthStatus !== health.status) &&
          (!prevHealth ||
            prevHealth.loadPercent !== health.loadPercent ||
            prevHealth.status !== health.status)
        ) {
          updateNodeData(node.id, {
            loadPercent: health.loadPercent,
            healthStatus: health.status as 'healthy' | 'warning' | 'critical',
          });
          hasNodeChanges = true;
        }
      }

      // Cache current health state to avoid redundant updates
      lastHealthRef.current = new Map(nodeHealth);

      // 2. Update edge health classes (batched)
      if (hasNodeChanges) {
        let edgesChanged = false;
        const newEdges = edges.map(edge => {
          const sourceHealth = nodeHealth.get(edge.source)?.status || 'healthy';
          const targetHealth = nodeHealth.get(edge.target)?.status || 'healthy';

          let edgeClass = 'edge-healthy';
          if (sourceHealth === 'critical' || targetHealth === 'critical') {
            edgeClass = 'edge-critical';
          } else if (sourceHealth === 'warning' || targetHealth === 'warning') {
            edgeClass = 'edge-warning';
          }

          if (edge.className !== edgeClass) {
            edgesChanged = true;
            return { ...edge, className: edgeClass };
          }
          return edge;
        });

        if (edgesChanged) {
          setEdges(newEdges);
        }
      }

      rafRef.current = null;
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [nodeHealth]);
}
