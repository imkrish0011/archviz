import type { ArchNode, ArchEdge, Recommendation, Warning } from '../types';
import { calculateCarbonFootprints } from './carbonEngine';

/**
 * Recommendation Engine
 * Rule-based triggers that suggest architecture improvements.
 */

export function generateRecommendations(
  nodes: ArchNode[],
  _edges: ArchEdge[],
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
  
  // ── Rule 7: GreenOps — High carbon footprint nodes ──
  const footprints = calculateCarbonFootprints(nodes);
  const highCarbonNodes = footprints.filter(f => f.rating === 'high' && f.potentialSavingsKg && f.potentialSavingsKg > 1);
  
  if (highCarbonNodes.length > 0) {
    const worst = highCarbonNodes.sort((a, b) => (b.potentialSavingsKg || 0) - (a.potentialSavingsKg || 0))[0];
    recommendations.push({
      id: `greenops-${worst.nodeId}`,
      reason: `${worst.label} in ${worst.regionLabel} (${worst.region}) emits ${worst.monthlyCO2kg}kg CO₂/month. Migrating to ${worst.suggestedRegion} could save ~${worst.potentialSavingsKg}kg CO₂/month.`,
      expectedImprovement: `${Math.round((worst.potentialSavingsKg! / worst.monthlyCO2kg) * 100)}% carbon reduction for this component`,
      costImpact: 'Similar cost (same tier)',
      severity: 'medium',
      solution: `Move ${worst.label} from ${worst.region} to ${worst.suggestedRegion} to reduce environmental impact. Cross-region latency impact: +20-40ms.`,
      insight: `Your architecture emits approximately ${footprints.reduce((s, f) => s + f.monthlyCO2kg, 0).toFixed(1)}kg CO₂/month. ${highCarbonNodes.length} component${highCarbonNodes.length > 1 ? 's are' : ' is'} in high-carbon grid regions.`,
    });
  }
  
  // ── Rule 8: Bespoke — Lambda oversized memory ──
  for (const node of activeNodes) {
    if (node.data.componentType === 'lambda' && node.data.lambdaMemory) {
      const load = nodeLoads.get(node.id) || 0;
      const cap = node.data.tier.capacity * node.data.instances;
      if (cap > 0 && node.data.lambdaMemory > 1024 && load / cap < 0.3) {
        recommendations.push({
          id: `lambda-oversized-${node.id}`,
          reason: `${node.data.label} has ${node.data.lambdaMemory}MB allocated but uses only ${Math.round((load / cap) * 100)}% capacity. Lambda charges per GB-second — excess memory is wasted cost.`,
          expectedImprovement: 'Up to 50% cost reduction for this function',
          costImpact: `Save ~$${Math.round(node.data.lambdaMemory * 0.01)}/mo`,
          severity: 'medium',
          solution: `Reduce memory to 512MB or 256MB in the Lambda Configuration panel. CPU scales proportionally, so test performance first.`,
          insight: `AWS Lambda charges $0.0000166667 per GB-second. At ${node.data.lambdaMemory}MB with low utilization, you're paying for idle compute.`,
        });
        break;
      }
    }
  }

  // ── Rule 9: Bespoke — Kafka under-replicated ──
  for (const node of activeNodes) {
    if ((node.data.componentType === 'kafka' || node.data.componentType === 'confluent-kafka') &&
        (node.data.kafkaReplicationFactor || 3) < 3) {
      recommendations.push({
        id: `kafka-replication-${node.id}`,
        reason: `${node.data.label} has replication factor ${node.data.kafkaReplicationFactor}. A single broker failure will cause data loss.`,
        expectedImprovement: 'Zero data loss during broker failures',
        costImpact: `+~$${Math.round((node.data.tier.monthlyCost || 453) * 0.5)}/mo for additional brokers`,
        severity: 'high',
        solution: 'Increase replication factor to 3 in the Kafka Configuration panel.',
        insight: 'Industry standard is replication factor = 3 for production Kafka clusters. This ensures 2 broker failures can be tolerated.',
      });
      break;
    }
  }

  // ── Rule 10: Bespoke — S3 without lifecycle for cost savings ──
  for (const node of activeNodes) {
    if (node.data.componentType === 's3' && !node.data.s3LifecycleGlacierDays && (Number(node.data.storageGB) || 100) > 500) {
      recommendations.push({
        id: `s3-lifecycle-${node.id}`,
        reason: `${node.data.label} stores ${Number(node.data.storageGB) || 100}GB without lifecycle rules. Old data could be automatically archived to Glacier for 90% savings.`,
        expectedImprovement: '60-90% storage cost reduction for aged data',
        costImpact: `Save ~$${Math.round((Number(node.data.storageGB) || 100) * 0.02)}/mo`,
        severity: 'low',
        solution: 'Set "Lifecycle — Glacier Transition" to 90 days in the S3 Configuration panel.',
      });
      break;
    }
  }

  // ── Rule 11: Bespoke — API Gateway without auth ──
  for (const node of activeNodes) {
    if (node.data.componentType === 'api-gateway' && (!node.data.apigwAuthType || node.data.apigwAuthType === 'none')) {
      recommendations.push({
        id: `apigw-auth-${node.id}`,
        reason: `${node.data.label} has no authorization configured. All API endpoints are publicly callable.`,
        expectedImprovement: 'Prevent unauthorized access and abuse',
        costImpact: 'Free (JWT) or minimal ($3.50/mo for API keys)',
        severity: 'high',
        solution: 'Set "Authorization Type" to JWT or IAM in the API Gateway Configuration panel.',
        insight: 'An unprotected API gateway is the #1 vector for abuse, cost attacks, and data breaches.',
      });
      break;
    }
  }
  
  return recommendations;
}

/**
 * Generate warnings for the bottom bar.
 */
export function generateWarnings(
  nodes: ArchNode[],
  _edges: ArchEdge[],
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
