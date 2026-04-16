import type { ArchNode } from '../types';

/**
 * Cost Engine
 * Calculates individual and total system costs using real AWS pricing.
 */

export function getComponentCost(node: ArchNode): number {
  let baseCost = node.data.tier.monthlyCost;
  
  // Storage Types
  if (node.data.volumeType === 'io1') baseCost *= 2.5; // High performance IOPS charge
  if (node.data.volumeType === 'magnetic') baseCost *= 0.6; // Low cost
  
  // Calculate quantity of instances
  let instances = node.data.scalingType === 'horizontal' ? node.data.instances : 1;
  const isDB = ['postgresql', 'mysql', 'mongodb', 'cassandra', 'dynamodb', 'aurora-serverless', 'bigtable'].includes(node.data.componentType);
  
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

export function calculateTotalCost(nodes: ArchNode[]): number {
  let total = 0;
  for (const node of nodes) {
    if (!node.data.isDisabled) {
      total += getComponentCost(node);
    }
  }
  return Math.round(total * 100) / 100;
}

export function getScalingCostDelta(
  node: ArchNode,
  newInstances: number
): number {
  const currentCost = getComponentCost(node);
  const newCost = node.data.tier.monthlyCost * newInstances;
  return Math.round((newCost - currentCost) * 100) / 100;
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
