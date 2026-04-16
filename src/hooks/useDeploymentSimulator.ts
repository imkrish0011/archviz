import { useEffect, useRef } from 'react';
import { useArchStore } from '../store/useArchStore';
import { getTrafficShiftSchedule, updateEdgeTrafficWeights } from '../engine/deploymentSimulator';

export function useDeploymentSimulator() {
  const deploymentState = useArchStore(s => s.deploymentState);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!deploymentState.isActive || !deploymentState.startedAt) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Only start interval once per deployment
    if (timerRef.current) return;

    const schedule = getTrafficShiftSchedule();
    const maxDelay = schedule[schedule.length - 1].delayMs;

    timerRef.current = window.setInterval(() => {
      const state = useArchStore.getState();
      const currentDS = state.deploymentState;
      if (!currentDS.isActive || !currentDS.startedAt) return;

      const elapsed = Date.now() - currentDS.startedAt;
      
      if (elapsed >= maxDelay) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        state.completeDeployment();
        return;
      }

      // Find the appropriate weight based on elapsed time
      let currentWeight = 0;
      for (let i = schedule.length - 1; i >= 0; i--) {
        if (elapsed >= schedule[i].delayMs) {
          currentWeight = schedule[i].weightV2;
          break;
        }
      }

      if (currentWeight !== currentDS.trafficWeightV2) {
        state.updateDeploymentState({ trafficWeightV2: currentWeight });
        
        const newEdges = updateEdgeTrafficWeights(
          state.edges,
          currentDS.sourceNodeIds,
          currentDS.cloneNodeIds,
          currentWeight
        );
        state.setEdges(newEdges);
      }

    }, 250);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [deploymentState.isActive, deploymentState.startedAt]);
}
