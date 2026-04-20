import type { ArchNode, ArchEdge } from '../types';

/**
 * Failure Model
 * Calculates system reliability and availability.
 */

export function calculateSystemReliability(
  nodes: ArchNode[],
  edges: ArchEdge[]
): number {
  const activeNodes = nodes.filter(n => !n.data.isDisabled && !n.data.isFailed);
  if (activeNodes.length === 0) return 0;
  
  let reliability = 1;
  
  for (const node of activeNodes) {
    let nodeReliability = node.data.reliability;
    
    // Spot instances penalty
    if (node.data.pricingModel === 'spot') {
      nodeReliability *= 0.90; // High chance of interruption
    }

    // High availability bonuses
    if (node.data.drStrategy === 'active-active') {
      nodeReliability = 1 - ((1 - nodeReliability) * 0.1); // Massive reliability boost
    } else if (node.data.drStrategy === 'active-passive') {
      nodeReliability = 1 - ((1 - nodeReliability) * 0.5); // Moderate boost
    }

    if (node.data.multiAZ) {
      nodeReliability = 1 - ((1 - nodeReliability) * 0.2); // Good boost
    }

    // Security & Auth Reliability Adjustments
    if (node.data.mfaEnabled) {
      nodeReliability = 1 - ((1 - nodeReliability) * 0.4); // MFA massive reduction in account compromise risk
    }
    if (node.data.strictTls) {
      nodeReliability = 1 - ((1 - nodeReliability) * 0.05); // Minor boost to prevent downgrade attacks
    }

    if (node.data.sessionStrategy === 'stateful') {
      nodeReliability *= 0.98; // Stateful sessions inherently add minor failure points
    }
    
    // Single instance penalty
    if (node.data.instances <= 1 && node.data.scalingType === 'horizontal') {
      nodeReliability *= 0.85;
    }
    
    reliability *= nodeReliability;
  }
  
  // No load balancer penalty
  const hasLB = nodes.some(n => n.data.componentType === 'load-balancer' && !n.data.isDisabled);
  const serverCount = nodes.filter(n => 
    ['api-server', 'web-server', 'websocket-server'].includes(n.data.componentType) && !n.data.isDisabled
  ).length;
  
  if (!hasLB && serverCount > 1) {
    reliability *= 0.7;
  }
  
  // Failed nodes impact
  const failedNodes = nodes.filter(n => n.data.isFailed);
  if (failedNodes.length > 0) {
    reliability *= Math.pow(0.5, failedNodes.length);
  }
  
  // Check for single points of failure in the edge graph
  // (result consumed by future telemetry integration)
  findSinglePointsOfFailure(nodes, edges);
  
  return Math.max(0, Math.min(1, reliability));
}

export function calculateAvailability(reliability: number): number {
  // Convert reliability to availability percentage
  // e.g., 0.999 → 99.9%
  return Math.round(reliability * 10000) / 100;
}

export function formatAvailability(availability: number): string {
  if (availability >= 99.99) return '99.99%';
  if (availability >= 99.9) return `${availability.toFixed(2)}%`;
  return `${availability.toFixed(1)}%`;
}

function findSinglePointsOfFailure(
  nodes: ArchNode[],
  edges: ArchEdge[]
): string[] {
  const spofs: string[] = [];
  const activeNodes = nodes.filter(n => !n.data.isDisabled);
  
  for (const node of activeNodes) {
    // A node is a SPOF if:
    // 1. It's the only node of its type
    // 2. It has both incoming and outgoing edges
    // 3. It has only 1 instance
    const sameType = activeNodes.filter(n => n.data.componentType === node.data.componentType);
    const hasIncoming = edges.some(e => e.target === node.id);
    const hasOutgoing = edges.some(e => e.source === node.id);
    
    if (sameType.length === 1 && hasIncoming && hasOutgoing && node.data.instances <= 1) {
      spofs.push(node.id);
    }
  }
  
  return spofs;
}

export { findSinglePointsOfFailure };
