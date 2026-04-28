import type { ArchNode, ArchEdge, CloudProvider } from '../types';
import { getGeoZone, getRegionalPricingMultiplier } from './regionUtils';

/**
 * Cost Engine
 * Calculates individual and total system costs using AWS base pricing and cloud provider offsets.
 */

export function getComponentCost(node: ArchNode, load: number = 0, provider: CloudProvider = 'aws'): number {
  let baseCost = node.data.tier.monthlyCost;
  
  if (provider === 'gcp') {
    baseCost *= node.data.tier.pricingOffsets?.gcp || 0.92; // GCP is typically 8% cheaper compute
  } else if (provider === 'azure') {
    baseCost *= node.data.tier.pricingOffsets?.azure || 1.05; // Azure is often slightly more expensive
  }

  // Apply Regional Pricing Multiplier
  const zone = getGeoZone(node.data.region as string | undefined);
  baseCost *= getRegionalPricingMultiplier(zone);
  
  // Calculate dynamic serverless execution costs
  const serverlessTypes = ['lambda', 'api-gateway', 'cloudflare-workers', 'step-functions', 'vercel', 'netlify', 'cloudflare-pages', 'supabase', 'planetscale', 'firebase', 'digitalocean-app'];
  if (serverlessTypes.includes(node.data.componentType)) {
    const monthlyRequests = load * 2.628e6;
    if (node.data.tier.costPerMillionRequests) {
      // Math: load (requests-per-second) * seconds_in_month * cost_per_million / 1,000,000
      const dynamicCost = (monthlyRequests * node.data.tier.costPerMillionRequests) / 1000000;
      baseCost += dynamicCost;
    } else {
      // PaaS fallback: usually they have a free capacity limit (assume 1M reqs) and then charge overage
      const freeCapacity = node.data.tier.capacity || 1000000;
      if (monthlyRequests > freeCapacity) {
        const overage = monthlyRequests - freeCapacity;
        // Typical serverless overage price: ~$2 per million reqs
        baseCost += (overage / 1000000) * 2.0;
      }
    }
  }
  
  // ── Bespoke: Lambda memory-based pricing ──
  if (node.data.componentType === 'lambda' && node.data.lambdaMemory) {
    // AWS Lambda pricing: $0.0000166667 per GB-second
    // Monthly cost = (memoryGB * avgDurationSec * invocations) * pricePerGBsec
    const memoryGB = (node.data.lambdaMemory || 512) / 1024;
    const avgDuration = Math.min((node.data.lambdaTimeout || 15) * 0.3, 10); // assume 30% of timeout as avg
    const monthlyInvocations = load > 0 ? load * 2.628e6 : 1000000;
    const computeGBseconds = memoryGB * avgDuration * monthlyInvocations;
    baseCost = (computeGBseconds * 0.0000166667) + (monthlyInvocations * 0.0000002); // + $0.20 per million requests
  }

  // ── Bespoke: S3 storage class pricing ──
  if (node.data.componentType === 's3' && node.data.s3StorageClass) {
    const storageMultipliers: Record<string, number> = {
      'STANDARD': 1.0,
      'INTELLIGENT_TIERING': 0.95,
      'STANDARD_IA': 0.6,
      'GLACIER': 0.1,
    };
    baseCost *= storageMultipliers[node.data.s3StorageClass] || 1.0;
    if (node.data.s3Versioning) baseCost *= 1.3; // versioning adds ~30% storage overhead
  }

  // ── Bespoke: Kafka per-partition pricing ──
  if ((node.data.componentType === 'kafka' || node.data.componentType === 'confluent-kafka') && node.data.kafkaPartitions) {
    const partitions = node.data.kafkaPartitions || 6;
    const retentionDays = node.data.kafkaRetentionDays || 7;
    const replicationFactor = node.data.kafkaReplicationFactor || 3;
    // More partitions/replicas = more storage & broker overhead
    baseCost *= (partitions / 6) * (replicationFactor / 3);
    baseCost += retentionDays * 0.5; // ~$0.50/day for storage retention
  }
  
  // Storage Types
  if (node.data.volumeType === 'io1') baseCost *= 2.5; // High performance IOPS charge
  if (node.data.volumeType === 'magnetic') baseCost *= 0.6; // Low cost
  
  if (node.data.storageGB) {
    baseCost += Number(node.data.storageGB) * 0.08;
  }
  
  // Calculate quantity of instances
  let instances = node.data.scalingType === 'horizontal' ? node.data.instances : 1;
  const isDB = ['postgresql', 'mysql', 'mongodb', 'cassandra', 'dynamodb', 'aurora-serverless', 'bigtable'].includes(node.data.componentType);
  
  // Auto-scaling logic: if load exceeds current capacity, simulate auto-scaling
  if (node.data.scalingType === 'horizontal' && node.data.tier.capacity && load > 0) {
    const requiredInstances = Math.ceil(load / node.data.tier.capacity);
    if (requiredInstances > instances) {
      instances = requiredInstances;
    }
  }
  
  // Add read replicas for DBs
  if (isDB && node.data.readReplicas) {
    instances += Number(node.data.readReplicas) * 0.7; // Replicas cost ~70%
  }
  
  let computedCost = baseCost * instances;
  
  // Add Multi-AZ Premium
  if (node.data.multiAZ) {
    computedCost *= 1.5; // Multi-AZ practically doubles infra, we simulate 50% premium
  }
  
  // Pricing Models (Savings Plans, Reserved, Spot)
  if (node.data.pricingModel === 'savings-1yr') {
    computedCost *= 0.70; // -30%
  } else if (node.data.pricingModel === 'reserved-3yr') {
    computedCost *= 0.50; // -50%
  } else if (node.data.pricingModel === 'spot') {
    computedCost *= 0.30; // -70%
  }

  return computedCost;
}

export function calculateTotalCost(
  nodes: ArchNode[], 
  edges: ArchEdge[] = [], 
  nodeLoads?: Map<string, number>,
  provider: CloudProvider = 'aws'
): number {
  let total = 0;
  
  // 1. Component & Compute Costs
  for (const node of nodes) {
    if (!node.data.isDisabled) {
      const load = nodeLoads?.get(node.id) || 0;
      total += getComponentCost(node, load, provider);
    }
  }
  
  // 2. Data Transfer / Egress Costs
  let EGRESS_RATE_PER_GB = 0.09;
  if (provider === 'gcp') EGRESS_RATE_PER_GB = 0.085;
  if (provider === 'azure') EGRESS_RATE_PER_GB = 0.087;
  
  for (const edge of edges) {
    const config = edge.config || {};
    
    // Check if the edge crosses an AZ or goes to internet (client)
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    const isCrossRegion = sourceNode && targetNode && getGeoZone(sourceNode.data.region as string | undefined) !== getGeoZone(targetNode.data.region as string | undefined);
    const crossesBoundary = config.isCrossAZ || targetNode?.data.category === 'client' || isCrossRegion;
    
    if (crossesBoundary && sourceNode && !sourceNode.data.isDisabled) {
      const sourceLoad = nodeLoads?.get(sourceNode.id) || 0;
      const payloadSizeBytes = config.payloadSizeBytes || 1024; // default to 1KB
      
      // Math: RPS * seconds_in_month * bytes = Bytes per month -> convert to GB -> multiply by rate
      const bytesPerMonth = sourceLoad * payloadSizeBytes * 2.628e6;
      const gbPerMonth = bytesPerMonth / 1e9;
      total += gbPerMonth * EGRESS_RATE_PER_GB;
    }
  }
  
  return Math.round(total * 100) / 100;
}

export function getScalingCostDelta(
  node: ArchNode,
  newInstances: number,
  provider: CloudProvider = 'aws'
): number {
  const currentCost = getComponentCost(node, 0, provider);
  let baseTierCost = node.data.tier.monthlyCost;
  if (provider === 'gcp') baseTierCost *= node.data.tier.pricingOffsets?.gcp || 0.92;
  if (provider === 'azure') baseTierCost *= node.data.tier.pricingOffsets?.azure || 1.05;
  
  const newCost = baseTierCost * newInstances;
  return Math.round((newCost - currentCost) * 100) / 100;
}

export function getArbitrageCosts(
  nodes: ArchNode[],
  edges: ArchEdge[] = [],
  nodeLoads?: Map<string, number>
): Record<CloudProvider, number> {
  return {
    aws: calculateTotalCost(nodes, edges, nodeLoads, 'aws'),
    gcp: calculateTotalCost(nodes, edges, nodeLoads, 'gcp'),
    azure: calculateTotalCost(nodes, edges, nodeLoads, 'azure')
  };
}

export function formatCost(cost: number): string {
  if (cost >= 1000) {
    return `$${(cost / 1000).toFixed(1)}k`;
  }
  return `$${cost.toFixed(0)}`;
}

export function formatCostFull(cost: number): string {
  return `$${cost.toFixed(2)}/mo`;
}

export interface CostBreakdown {
  compute: number;
  storage: number;
  network: number;
  messaging: number;
  serverless: number;
  observability: number;
  other: number;
  total: number;
  topComponents: { label: string; cost: number; category: string }[];
}

export function calculateCostBreakdown(
  nodes: ArchNode[],
  edges: ArchEdge[] = [],
  nodeLoads?: Map<string, number>,
  provider: CloudProvider = 'aws'
): CostBreakdown {
  const breakdown: CostBreakdown = {
    compute: 0, storage: 0, network: 0, messaging: 0,
    serverless: 0, observability: 0, other: 0, total: 0,
    topComponents: [],
  };

  const componentCosts: { label: string; cost: number; category: string }[] = [];

  for (const node of nodes) {
    if (node.data.isDisabled) continue;
    const load = nodeLoads?.get(node.id) || 0;
    const cost = getComponentCost(node, load, provider);
    if (cost <= 0) continue;

    const cat = node.data.category;
    componentCosts.push({ label: node.data.label, cost, category: cat });

    const serverlessTypes = ['lambda', 'cloudflare-workers', 'step-functions', 'vercel', 'netlify', 'cloudflare-pages', 'firebase', 'digitalocean-app'];
    if (serverlessTypes.includes(node.data.componentType)) {
      breakdown.serverless += cost;
    } else if (['compute', 'alt-cloud'].includes(cat)) {
      breakdown.compute += cost;
    } else if (cat === 'storage') {
      breakdown.storage += cost;
    } else if (cat === 'network') {
      breakdown.network += cost;
    } else if (cat === 'messaging') {
      breakdown.messaging += cost;
    } else if (cat === 'observability') {
      breakdown.observability += cost;
    } else {
      breakdown.other += cost;
    }
  }

  // Data transfer costs → network bucket
  let EGRESS_RATE_PER_GB = 0.09;
  if (provider === 'gcp') EGRESS_RATE_PER_GB = 0.085;
  if (provider === 'azure') EGRESS_RATE_PER_GB = 0.087;

  for (const edge of edges) {
    const config = edge.config || {};
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    const isCrossRegion = sourceNode && targetNode && getGeoZone(sourceNode.data.region as string | undefined) !== getGeoZone(targetNode.data.region as string | undefined);
    const crossesBoundary = config.isCrossAZ || targetNode?.data.category === 'client' || isCrossRegion;
    if (crossesBoundary && sourceNode && !sourceNode.data.isDisabled) {
      const sourceLoad = nodeLoads?.get(sourceNode.id) || 0;
      const payloadSizeBytes = config.payloadSizeBytes || 1024;
      const bytesPerMonth = sourceLoad * payloadSizeBytes * 2.628e6;
      const gbPerMonth = bytesPerMonth / 1e9;
      breakdown.network += gbPerMonth * EGRESS_RATE_PER_GB;
    }
  }

  breakdown.total = breakdown.compute + breakdown.storage + breakdown.network +
    breakdown.messaging + breakdown.serverless + breakdown.observability + breakdown.other;

  // Top 5 most expensive
  breakdown.topComponents = componentCosts
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  return breakdown;
}
