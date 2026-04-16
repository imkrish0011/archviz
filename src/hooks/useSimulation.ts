import { useMemo } from 'react';
import { useArchStore } from '../store/useArchStore';
import { runSimulation } from '../engine/simulator';
import type { SystemMetrics } from '../types';

export function useSimulation(): {
  metrics: SystemMetrics;
  nodeLoads: Map<string, number>;
  nodeHealth: Map<string, { loadPercent: number; status: string }>;
} {
  const nodes = useArchStore(s => s.nodes);
  const edges = useArchStore(s => s.edges);
  const config = useArchStore(s => s.simulationConfig);
  
  return useMemo(() => {
    if (nodes.length === 0) {
      return {
        metrics: {
          totalCost: 0,
          estimatedLatency: 0,
          healthScore: 100,
          letterGrade: 'A' as const,
          throughput: 0,
          availability: 100,
          compositeSLA: 100,
          nines: '5',
          downtimePerYear: '0s',
          downtimePerMonth: '0s',
          bottlenecks: [],
          warnings: [],
          recommendations: [],
        },
        nodeLoads: new Map(),
        nodeHealth: new Map(),
      };
    }
    return runSimulation(nodes, edges, config);
  }, [nodes, edges, config]);
}
