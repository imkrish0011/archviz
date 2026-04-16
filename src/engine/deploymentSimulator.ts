import type { ArchNode, ArchEdge } from '../types';

/**
 * Deployment Simulator
 * Manages Blue/Green and Canary deployment rollout state machines.
 */

export interface DeploymentState {
  isActive: boolean;
  phase: 'idle' | 'canary' | 'shifting' | 'draining' | 'complete';
  trafficWeightV2: number;  // 0-100
  sourceNodeIds: string[];  // Blue (v1) node IDs
  cloneNodeIds: string[];   // Green (v2) node IDs
  startedAt: number | null;
  targetNodeType: string;
}

const INITIAL_DEPLOYMENT_STATE: DeploymentState = {
  isActive: false,
  phase: 'idle',
  trafficWeightV2: 0,
  sourceNodeIds: [],
  cloneNodeIds: [],
  startedAt: null,
  targetNodeType: '',
};

/**
 * Creates Green (v2) clones of the selected Blue (v1) nodes
 */
export function createDeploymentClones(
  sourceNodes: ArchNode[],
): { updatedSources: ArchNode[]; clones: ArchNode[] } {
  const updatedSources: ArchNode[] = [];
  const clones: ArchNode[] = [];
  
  for (const node of sourceNodes) {
    // Mark original as v1 (Blue)
    updatedSources.push({
      ...node,
      data: {
        ...node.data,
        appVersion: 'v1',
        label: `${node.data.label} (Blue)`,
      },
    });
    
    // Create Green clone
    const cloneId = `${node.id}_v2_${Date.now()}`;
    clones.push({
      ...node,
      id: cloneId,
      position: {
        x: node.position.x,
        y: node.position.y + 120, // Place below original
      },
      data: {
        ...node.data,
        appVersion: 'v2',
        isDeploymentClone: true,
        label: `${node.data.label.replace(/ \(Blue\)$/, '')} (Green)`,
        loadPercent: 0,
        healthStatus: 'healthy',
      },
    });
  }
  
  return { updatedSources, clones };
}

/**
 * Get the traffic shift schedule for a 10-second rollout
 * Returns [seconds, v2Weight] pairs
 */
export function getTrafficShiftSchedule(): Array<{ delayMs: number; weightV2: number }> {
  return [
    { delayMs: 0,    weightV2: 0 },
    { delayMs: 2000, weightV2: 10 },
    { delayMs: 4000, weightV2: 25 },
    { delayMs: 6000, weightV2: 50 },
    { delayMs: 8000, weightV2: 75 },
    { delayMs: 9000, weightV2: 90 },
    { delayMs: 10000, weightV2: 100 },
  ];
}

/**
 * Reroute edges during deployment: update traffic weight labels
 */
export function updateEdgeTrafficWeights(
  edges: ArchEdge[],
  sourceNodeIds: string[],
  cloneNodeIds: string[],
  weightV2: number,
): ArchEdge[] {
  const weightV1 = 100 - weightV2;
  
  return edges.map(edge => {
    // Edges targeting Blue (v1) nodes
    if (sourceNodeIds.includes(edge.target)) {
      return {
        ...edge,
        data: {
          ...edge.data,
          config: {
            ...(edge.data as Record<string, unknown>)?.config as Record<string, unknown> || {},
            trafficWeight: weightV1,
            edgeLabel: weightV2 > 0 ? `${weightV1}%` : undefined,
          },
        },
      };
    }
    
    // Edges targeting Green (v2) nodes
    if (cloneNodeIds.includes(edge.target)) {
      return {
        ...edge,
        data: {
          ...edge.data,
          config: {
            ...(edge.data as Record<string, unknown>)?.config as Record<string, unknown> || {},
            trafficWeight: weightV2,
            edgeLabel: weightV2 > 0 ? `${weightV2}%` : undefined,
          },
        },
      };
    }
    
    return edge;
  });
}

export { INITIAL_DEPLOYMENT_STATE };
