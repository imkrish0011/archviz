import type { ArchNode, ArchEdge } from '../types';

/**
 * Latency Model
 * Calculates total system latency including overload penalties.
 */

const previousNodeLoads = new Map<string, number>();

export function calculateOverloadMultiplier(load: number, capacity: number): number {
  if (capacity <= 0) return 10;
  const ratio = load / capacity;
  if (ratio <= 1) return 1;
  return Math.pow(ratio, 2);
}

export function calculateNodeLatency(
  node: ArchNode,
  load: number,
  activeEvent?: string | null
): number {
  let baseLatency = node.data.tier.latency;
  
  if (node.data.dataResidency === 'strict-eu') {
    baseLatency += 45; // EU strict geo-fencing hop penalty
  } else if (node.data.dataResidency === 'strict-us') {
    baseLatency += 35; // US strict geo-fencing hop penalty
  }

  if (node.data.sessionStrategy === 'stateful') {
    baseLatency += 5; // Session retrieval overhead
  }
  
  if (node.data.mfaEnabled) {
    baseLatency += 40; // Simulated MFA verification delay
  }

  if (node.data.containerRuntime === 'firecracker') {
    baseLatency *= 0.95; // MicroVM speedups
  }

  const capacity = node.data.tier.capacity * node.data.instances;
  const multiplier = calculateOverloadMultiplier(load, capacity);
  let finalLatency = baseLatency * multiplier;
  
  // Cold Start Penalty Check
  const serverlessTypes = ['lambda', 'aurora-serverless'];
  if (serverlessTypes.includes(node.data.componentType)) {
    const prevLoad = previousNodeLoads.get(node.id);
    const wasAsleep = prevLoad === 0 || prevLoad === undefined;
    
    // Inject delay if waking up or explicitly forced via traffic spike event
    if ((wasAsleep && load > 0) || activeEvent === 'trafficSpike') {
      const coldStartDelay = Math.random() * 1500 + 500; // 500ms -> 2000ms
      finalLatency += coldStartDelay;
    }
  }
  
  return finalLatency;
}

/**
 * Calculate total system latency as the sum of critical path latencies.
 * Uses a simplified model: find longest path through the graph.
 */
export function calculateTotalLatency(
  nodes: ArchNode[],
  edges: ArchEdge[],
  nodeLoads: Map<string, number>,
  activeEvent?: string | null
): number {
  if (nodes.length === 0) return 0;
  
  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    const sources = adjacency.get(edge.source);
    if (sources) sources.push(edge.target);
  }
  
  // Find nodes with no incoming edges (entry points)
  const hasIncoming = new Set<string>();
  for (const edge of edges) {
    hasIncoming.add(edge.target);
  }
  const entryNodes = nodes.filter(n => !hasIncoming.has(n.id) && !n.data.isDisabled);
  
  // If no clear entry point, use all nodes
  const starts = entryNodes.length > 0 ? entryNodes : nodes.filter(n => !n.data.isDisabled);
  
  // DFS to find longest path (critical path)
  let maxLatency = 0;
  
  function dfs(nodeId: string, currentLatency: number, visited: Set<string>) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.data.isDisabled) return;
    
    const load = nodeLoads.get(nodeId) || 0;
    const nodeLatency = calculateNodeLatency(node, load, activeEvent);
    const totalSoFar = currentLatency + nodeLatency;
    
    const neighbors = adjacency.get(nodeId) || [];
    if (neighbors.length === 0) {
      maxLatency = Math.max(maxLatency, totalSoFar);
    } else {
      for (const neighbor of neighbors) {
        dfs(neighbor, totalSoFar, new Set(visited));
      }
    }
  }
  
  for (const start of starts) {
    dfs(start.id, 0, new Set());
  }
  
  // Cache the loads for the next tick to check for cold starts
  previousNodeLoads.clear();
  for (const [nodeId, load] of nodeLoads.entries()) {
    previousNodeLoads.set(nodeId, load);
  }
  
  return Math.round(maxLatency * 100) / 100;
}
