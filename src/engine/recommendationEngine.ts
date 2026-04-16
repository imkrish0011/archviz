import type { ArchNode, ArchEdge, Recommendation, Warning } from '../types';

/**
 * Recommendation Engine
 * Rule-based triggers that suggest architecture improvements.
 */

export function generateRecommendations(
  nodes: ArchNode[],
  edges: ArchEdge[],
  rps: number,
  nodeLoads: Map<string, number>,
  totalCost: number
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const activeNodes = nodes.filter(n => !n.data.isDisabled && !n.data.isFailed);
  const dbTypes = ['postgresql', 'mysql', 'mongodb', 'cassandra', 'dynamodb', 'aurora-serverless'];
  
  // ── Rule 0: Dynamic Overload & Resilience Insights ──
  for (const node of activeNodes) {
    const load = nodeLoads.get(node.id) || 0;
    const cap = node.data.tier.capacity * node.data.instances;
    
    if (cap > 0 && load / cap > 0.95) { // Highly critical
      const loadPercent = Math.round((load / cap) * 100);
      
      let solution = '';
      if (node.data.scalingType === 'horizontal') {
        const requiredInstances = Math.ceil(load / node.data.tier.capacity);
        solution = `Increase instances to ${requiredInstances}x to distribute the load, or upgrade to a higher capacity tier.`;
      } else {
        solution = `Upgrade the component tier to handle higher capacity (vertical scaling), or add a cache layer to deflect reads.`;
      }
      
      let insight = '';
      const hasLB = activeNodes.some(n => n.data.componentType === 'load-balancer');
      const hasQueue = activeNodes.some(n => ['sqs', 'sns', 'kafka', 'message-queue', 'kinesis'].includes(n.data.componentType));
      
      if (hasQueue && dbTypes.includes(node.data.componentType) === false) {
        insight = `The system is avoiding total crash because the Message Queue is buffering requests. However, queue depth is likely exploding causing massive async latency.`;
      } else if (hasLB && node.data.scalingType === 'horizontal') {
        insight = `Load balancer is actively routing around, but all underlying instances are completely saturated causing 503 errors.`;
      } else if (dbTypes.includes(node.data.componentType)) {
        insight = `Database connections are exhausted. Read/write operations are failing cascading errors upstream.`;
      } else {
        insight = `Requests to this component are strictly timing out, causing immediate user-facing failures.`;
      }
      
      recommendations.push({
        id: `overload-${node.id}`,
        reason: `${node.data.label} is critically overloaded at ${loadPercent}% capacity.`,
        expectedImprovement: 'Restore normal system function and eliminate request timeouts.',
        costImpact: 'Varies based on scaling choice',
        severity: 'high',
        solution,
        insight,
      });
    }
  }
  
  // ── Rule 1: No cache + high DB load ──
  const hasCache = activeNodes.some(n => ['redis', 'memcached'].includes(n.data.componentType));
  const dbNodes = activeNodes.filter(n => dbTypes.includes(n.data.componentType));
  
  if (!hasCache && dbNodes.length > 0 && rps > 200) {
    const highLoadDB = dbNodes.some(n => {
      const load = nodeLoads.get(n.id) || 0;
      const cap = n.data.tier.capacity * n.data.instances;
      return load / cap > 0.5;
    });
    
    if (highLoadDB || rps > 500) {
      recommendations.push({
        id: 'add-cache',
        reason: 'Database is handling all requests directly. Adding Redis cache with a 60% hit rate would reduce DB load by 60%.',
        expectedImprovement: '60% reduction in DB load, ~40% latency improvement',
        costImpact: '+$13.32/mo (cache.t3.micro)',
        severity: 'high',
        componentToAdd: 'redis',
      });
    }
  }
  
  // ── Rule 2: No load balancer with multiple servers ──
  const hasLB = activeNodes.some(n => n.data.componentType === 'load-balancer');
  const serverNodes = activeNodes.filter(n => 
    ['api-server', 'web-server', 'websocket-server'].includes(n.data.componentType)
  );
  
  if (!hasLB && serverNodes.length > 0) {
    if (serverNodes.length > 1 || rps > 500) {
      recommendations.push({
        id: 'add-lb',
        reason: 'No load balancer detected. Traffic cannot be distributed across server instances, creating a single point of failure.',
        expectedImprovement: 'Even load distribution, failover capability, +30% reliability',
        costImpact: '+$22.27/mo (ALB)',
        severity: 'high',
        componentToAdd: 'load-balancer',
      });
    }
  }
  
  // ── Rule 3: High latency + no CDN ──
  const hasCDN = activeNodes.some(n => n.data.componentType === 'cdn');
  if (!hasCDN && rps > 1000) {
    recommendations.push({
      id: 'add-cdn',
      reason: 'At high traffic volumes, serving all content from origin servers increases latency for distant users.',
      expectedImprovement: '50-80% latency reduction for static content, reduced origin load',
      costImpact: '+$30/mo (CloudFront Basic)',
      severity: 'medium',
      componentToAdd: 'cdn',
    });
  }
  
  // ── Rule 4: Single instance of critical components ──
  for (const node of activeNodes) {
    if (node.data.instances <= 1 && 
        node.data.scalingType === 'horizontal' &&
        ['api-server', 'web-server', 'websocket-server'].includes(node.data.componentType)) {
      recommendations.push({
        id: `redundancy-${node.id}`,
        reason: `${node.data.label} has only 1 instance. If it fails, the entire system goes down.`,
        expectedImprovement: '~15% reliability improvement, zero-downtime deployments',
        costImpact: `+$${node.data.tier.monthlyCost.toFixed(2)}/mo per additional instance`,
        severity: 'high',
      });
      break; // Only show one redundancy recommendation
    }
  }
  
  // ── Rule 5: Cost optimization — oversized components ──
  for (const node of activeNodes) {
    const load = nodeLoads.get(node.id) || 0;
    const totalCap = node.data.tier.capacity * node.data.instances;
    if (totalCap > 0 && load / totalCap < 0.2 && node.data.tierIndex > 0) {
      const currentTierCost = node.data.tier.monthlyCost * node.data.instances;
      if (currentTierCost / totalCost > 0.3) {
        recommendations.push({
          id: `downsize-${node.id}`,
          reason: `${node.data.label} is using only ${Math.round((load / totalCap) * 100)}% of capacity. Consider downsizing the tier.`,
          expectedImprovement: 'Cost reduction with minimal performance impact',
          costImpact: `Save up to $${(currentTierCost * 0.4).toFixed(0)}/mo`,
          severity: 'low',
        });
        break;
      }
    }
  }
  
  // ── Rule 6: No message queue with many services ──
  const hasQueue = activeNodes.some(n => 
    ['sqs', 'sns', 'kafka', 'message-queue'].includes(n.data.componentType)
  );
  const serviceCount = activeNodes.filter(n => 
    ['api-server', 'worker', 'lambda'].includes(n.data.componentType)
  ).length;
  
  if (!hasQueue && serviceCount > 3) {
    recommendations.push({
      id: 'add-queue',
      reason: 'Multiple services are tightly coupled without async messaging. Adding a message queue decouples services and improves resilience.',
      expectedImprovement: 'Service isolation, retry capability, smoother load handling',
      costImpact: '+$1.60/mo (SQS Standard)',
      severity: 'medium',
      componentToAdd: 'sqs',
    });
  }
  
  return recommendations;
}

/**
 * Generate warnings for the bottom bar.
 */
export function generateWarnings(
  nodes: ArchNode[],
  edges: ArchEdge[],
  rps: number,
  nodeLoads: Map<string, number>
): Warning[] {
  const warnings: Warning[] = [];
  const activeNodes = nodes.filter(n => !n.data.isDisabled && !n.data.isFailed);
  
  // No load balancer
  const hasLB = activeNodes.some(n => n.data.componentType === 'load-balancer');
  if (!hasLB && activeNodes.length > 2) {
    warnings.push({
      id: 'no-lb',
      type: 'critical',
      message: 'No load balancer',
      recommendationId: 'add-lb',
    });
  }
  
  // Overload checks
  const dbTypes = ['postgresql', 'mysql', 'mongodb', 'cassandra', 'dynamodb', 'aurora-serverless'];
  for (const node of activeNodes) {
    const load = nodeLoads.get(node.id) || 0;
    const cap = node.data.tier.capacity * node.data.instances;
    
    // Critical Overload (Any node)
    if (cap > 0 && load / cap > 0.95) {
      warnings.push({
        id: `overload-${node.id}`,
        type: 'critical',
        message: `${node.data.label} overloaded`,
        recommendationId: `overload-${node.id}`,
      });
      break; // Just show one critical overload warning to avoid spanning the bar
    }
  }
  
  for (const node of activeNodes) {
    if (dbTypes.includes(node.data.componentType)) {
      const load = nodeLoads.get(node.id) || 0;
      const cap = node.data.tier.capacity * node.data.instances;
      if (cap > 0 && load / cap > 0.8 && load / cap <= 0.95) {
        warnings.push({
          id: `db-overload-${node.id}`,
          type: 'warning',
          message: 'DB capacity nearing limit',
          recommendationId: 'add-cache',
        });
        break;
      }
    }
  }
  
  // No cache layer
  const hasCache = activeNodes.some(n => n.data.componentType === 'redis');
  if (!hasCache && rps > 300 && activeNodes.some(n => dbTypes.includes(n.data.componentType))) {
    warnings.push({
      id: 'no-cache',
      type: 'warning',
      message: 'No cache layer',
      recommendationId: 'add-cache',
    });
  }
  
  // Single point of failure
  for (const node of activeNodes) {
    if (node.data.instances <= 1 && 
        node.data.scalingType === 'horizontal' &&
        ['api-server', 'web-server'].includes(node.data.componentType)) {
      warnings.push({
        id: 'spof',
        type: 'critical',
        message: 'Single point of failure',
      });
      break;
    }
  }
  
  return warnings;
}
