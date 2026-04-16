import type { ArchNode } from '../types';

/**
 * Scaling Model
 * Handles horizontal and vertical scaling calculations.
 */

export function calculateHorizontalCapacity(
  baseCapacity: number,
  instances: number
): number {
  return baseCapacity * instances;
}

export function calculateHorizontalCost(
  baseCost: number,
  instances: number
): number {
  return baseCost * instances;
}

export function calculateVerticalCapacity(
  baseCapacity: number,
  scalingFactor: number,
  tierIndex: number
): number {
  // Vertical scaling: capacity increases, but not linearly
  return Math.round(baseCapacity * Math.pow(scalingFactor, tierIndex));
}

export function calculateEffectiveCapacity(node: ArchNode): number {
  if (node.data.scalingType === 'horizontal') {
    return calculateHorizontalCapacity(
      node.data.tier.capacity,
      node.data.instances
    );
  }
  return node.data.tier.capacity;
}

export function getMaxInstances(_node: ArchNode): number {
  return 20; // Practical limit for the UI
}
