import type { ArchNode } from '../types';

/**
 * Traffic Model
 * Calculates load distribution across nodes and effective DB load with cache.
 */

export function calculateRPSFromUsers(users: number, multiplier: number): number {
  return Math.round(users * multiplier);
}

export function calculateLoadPerNode(rps: number, instances: number): number {
  if (instances <= 0) return rps;
  return rps / instances;
}

export function calculateEffectiveDBLoad(
  rps: number,
  cacheHitRate: number,
  hasCache: boolean
): number {
  if (!hasCache) return rps;
  return Math.round(rps * (1 - cacheHitRate));
}

/**
 * Finds all DB-type nodes and calculates their effective load,
 * considering whether a cache node exists in the architecture.
 */
export function calculateDBLoads(
  nodes: ArchNode[],
  rps: number,
  globalCacheHitRate: number
): Map<string, number> {
  const dbTypes = ['postgresql', 'mysql', 'mongodb', 'cassandra', 'dynamodb', 'aurora-serverless', 'bigtable', 'elasticsearch'];
  const cacheTypes = ['redis'];
  
  const hasCache = nodes.some(n => cacheTypes.includes(n.data.componentType) && !n.data.isDisabled);
  const dbLoads = new Map<string, number>();
  
  const dbNodes = nodes.filter(n => dbTypes.includes(n.data.componentType) && !n.data.isDisabled);
  const dbCount = dbNodes.length || 1;
  const rpsPerDB = rps / dbCount;
  
  for (const node of dbNodes) {
    const nodeHitRate = node.data.cacheHitRate ?? globalCacheHitRate;
    const effectiveLoad = calculateEffectiveDBLoad(rpsPerDB, nodeHitRate, hasCache);
    dbLoads.set(node.id, effectiveLoad);
  }
  
  return dbLoads;
}
