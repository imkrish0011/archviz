import type { ArchNode, Bottleneck, HealthStatus } from '../types';

/**
 * Bottleneck Detector
 * Identifies overloaded components and assigns health status.
 */

export function getHealthStatus(loadPercent: number): HealthStatus {
  if (loadPercent > 80) return 'critical';
  if (loadPercent > 60) return 'warning';
  return 'healthy';
}

export function calculateLoadPercent(
  load: number,
  capacity: number,
  instances: number
): number {
  const totalCapacity = capacity * instances;
  if (totalCapacity <= 0) return 100;
  return Math.min(100, Math.round((load / totalCapacity) * 100));
}

export function detectBottlenecks(
  nodes: ArchNode[],
  nodeLoads: Map<string, number>
): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];
  
  for (const node of nodes) {
    if (node.data.isDisabled || node.data.isFailed) continue;
    
    const load = nodeLoads.get(node.id) || 0;
    const capacity = node.data.tier.capacity;
    const instances = node.data.instances;
    
    const serverlessTypes = ['vercel', 'netlify', 'cloudflare-pages', 'supabase', 'planetscale', 'firebase', 'lambda', 'cloudflare-workers'];
    
    let loadPercent = calculateLoadPercent(load, capacity, instances);
    
    // Serverless types are infinitely scalable in terms of load, preventing them from failing during spikes.
    if (serverlessTypes.includes(node.data.componentType)) {
      loadPercent = Math.min(loadPercent, 50); // Cap load percent so they always show as healthy
    }
    
    const status = getHealthStatus(loadPercent);
    
    if (loadPercent > 60) {
      bottlenecks.push({
        nodeId: node.id,
        label: node.data.label,
        loadPercent,
        status,
      });
    }
  }
  
  // Sort by load descending
  bottlenecks.sort((a, b) => b.loadPercent - a.loadPercent);
  
  return bottlenecks;
}

/**
 * Calculate load for each node based on RPS and graph structure.
 * Distributes load through the graph following edge connections.
 */
export function calculateNodeLoads(
  nodes: ArchNode[],
  edges: { source: string; target: string }[],
  rps: number,
  dbLoads: Map<string, number>
): Map<string, number> {
  const loads = new Map<string, number>();
  const dbTypes = ['postgresql', 'mysql', 'mongodb', 'cassandra', 'dynamodb', 'aurora-serverless', 'bigtable', 'elasticsearch', 'supabase', 'planetscale', 'firebase'];
  const cacheTypes = ['redis'];
  const observabilityTypes = ['cloudwatch', 'datadog'];
  
  for (const node of nodes) {
    if (node.data.isDisabled || node.data.isFailed) {
      loads.set(node.id, 0);
      continue;
    }
    
    const type = node.data.componentType;
    
    if (dbTypes.includes(type)) {
      // Use calculated DB load
      loads.set(node.id, dbLoads.get(node.id) || rps);
    } else if (cacheTypes.includes(type)) {
      // Cache handles a portion of all requests (distribute across multiple cache nodes)
      const sameType = nodes.filter(n => cacheTypes.includes(n.data.componentType) && !n.data.isDisabled && !n.data.isFailed);
      const shareCount = sameType.length || 1;
      loads.set(node.id, Math.round(rps / shareCount));
    } else if (observabilityTypes.includes(type) || node.data.category === 'frontend-framework' || node.data.category === 'meta') {
      // Frameworks, meta, and observability tools don't consume simulated RPS infrastructure load directly
      loads.set(node.id, 0);
    } else if (['load-balancer', 'cdn', 'api-gateway', 'dns', 'vercel', 'netlify', 'cloudflare-pages'].includes(type)) {
      // Network components handle full RPS
      loads.set(node.id, rps);
    } else if (type === 'sqs' || type === 'sns' || type === 'kafka' || type === 'message-queue') {
      // Messaging handles a fraction
      const incomingEdges = edges.filter(e => e.target === node.id);
      loads.set(node.id, Math.round(rps * (incomingEdges.length > 0 ? 0.3 : 0.1)));
    } else if (type === 's3') {
      // Storage handles a small fraction
      loads.set(node.id, Math.round(rps * 0.1));
    } else {
      // Compute nodes: distribute RPS among same-type instances
      const sameType = nodes.filter(n => n.data.componentType === type && !n.data.isDisabled && !n.data.isFailed);
      const shareCount = sameType.length || 1;
      loads.set(node.id, Math.round(rps / shareCount));
    }
  }
  
  return loads;
}
