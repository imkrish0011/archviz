import { useCallback, useEffect, useRef } from 'react';
import { useArchStore } from '../store/useArchStore';
import type { SimulationEvent, ArchNode } from '../types';

/**
 * Handles simulation event execution.
 * Each event temporarily modifies the graph state, then reverts after a duration.
 */
export function useSimulationEvents() {
  const activeEvent = useArchStore(s => s.activeSimulationEvent);
  const setActiveEvent = useArchStore(s => s.setActiveSimulationEvent);
  const nodes = useArchStore(s => s.nodes);
  const updateNodeData = useArchStore(s => s.updateNodeData);
  const simulationConfig = useArchStore(s => s.simulationConfig);
  const setSimulationConfig = useArchStore(s => s.setSimulationConfig);
  
  const originalStateRef = useRef<{
    nodeStates: Map<string, Partial<ArchNode['data']>>;
    config: typeof simulationConfig;
  } | null>(null);
  
  const revert = useCallback(() => {
    if (originalStateRef.current) {
      const { nodeStates, config } = originalStateRef.current;
      for (const [id, data] of nodeStates.entries()) {
        updateNodeData(id, data);
      }
      setSimulationConfig(config);
      originalStateRef.current = null;
    }
    setActiveEvent(null);
  }, [updateNodeData, setSimulationConfig, setActiveEvent]);
  
  useEffect(() => {
    if (!activeEvent) return;
    
    // Save current state
    const nodeStates = new Map<string, Partial<ArchNode['data']>>();
    for (const node of nodes) {
      nodeStates.set(node.id, {
        isFailed: node.data.isFailed,
        isDisabled: node.data.isDisabled,
      });
    }
    originalStateRef.current = {
      nodeStates,
      config: { ...simulationConfig },
    };
    
    const eventHandlers: Record<SimulationEvent, () => void> = {
      serverCrash: () => {
        const servers = nodes.filter(n => 
          ['api-server', 'web-server', 'websocket-server'].includes(n.data.componentType) && !n.data.isFailed
        );
        if (servers.length > 0) {
          const target = servers[Math.floor(Math.random() * servers.length)];
          updateNodeData(target.id, { isFailed: true });
        }
      },
      removeCache: () => {
        nodes.filter(n => n.data.componentType === 'redis').forEach(n => {
          updateNodeData(n.id, { isDisabled: true });
        });
      },
      trafficSpike: () => {
        setSimulationConfig({
          concurrentUsers: simulationConfig.concurrentUsers * 10,
        });
      },
      cdnFailure: () => {
        nodes.filter(n => n.data.componentType === 'cdn').forEach(n => {
          updateNodeData(n.id, { isDisabled: true });
        });
      },
      dbFailover: () => {
        const dbs = nodes.filter(n => 
          ['postgresql', 'mysql', 'mongodb', 'cassandra'].includes(n.data.componentType) && !n.data.isFailed
        );
        if (dbs.length > 0) {
          updateNodeData(dbs[0].id, { isFailed: true });
        }
      },
    };
    
    eventHandlers[activeEvent]();
    
    return () => {
      // Cleanup happens manually when `revert` is called via the UI
    };
  }, [activeEvent]); // eslint-disable-line react-hooks/exhaustive-deps
  
  return { activeEvent, revert };
}
